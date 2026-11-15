// P4-1: production transcription via ElevenLabs Scribe (real-time WebSocket
// API, ~150ms latency). The browser gets a short-lived, single-use token
// from our own API (api/src/elevenlabs/createTranscriptionToken.ts) and
// streams raw 16kHz PCM audio directly to ElevenLabs -- our backend never
// sees the audio, and the real API key never reaches the browser.
//
// Protocol reference (there's no official lightweight JS client for the raw
// wire protocol, so this talks to the WebSocket directly):
// https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
import { getTranscriptionToken } from "../api/client.js";
import { MicPcm } from "./micPcm.js";
import type { TranscriptSource, TranscriptUpdate } from "./types.js";

const ENDPOINT = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

/** Message types the server sends that mean "stop, this session can't continue". */
const FATAL_MESSAGE_TYPES = new Set(["auth_error", "quota_exceeded", "unaccepted_terms"]);

interface ServerMessage {
  message_type: string;
  text?: string;
  error?: string;
}

export class ElevenLabsSource implements TranscriptSource {
  readonly name = "ElevenLabs Scribe";
  private ws: WebSocket | null = null;
  private readonly mic = new MicPcm();
  private unsubscribeMic: (() => void) | null = null;
  private running = false;
  private segmentIndex = 0;

  constructor(
    private readonly lang: "en" | "sv",
    private readonly deviceId?: string,
  ) {}

  async start(onUpdate: (u: TranscriptUpdate) => void, onStatus: (text: string) => void): Promise<void> {
    this.running = true;

    // Throws (501 if not configured, 502 on an ElevenLabs/network error) --
    // the caller (liveEngine.ts) catches this and falls back to the Web
    // Speech API rather than failing the whole mic.
    const token = await getTranscriptionToken();

    // Unlike Web Speech, ElevenLabs is fed audio we capture ourselves, so
    // the P4-6 device picker's choice actually applies here.
    await this.mic.start(this.deviceId);

    let segmentId = this.nextSegmentId();
    const params = new URLSearchParams({
      model_id: "scribe_v2_realtime",
      token,
      audio_format: "pcm_16000",
      language_code: this.lang,
      commit_strategy: "vad", // server auto-commits a segment after a pause, rather than us driving it
    });
    const ws = new WebSocket(`${ENDPOINT}?${params}`);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        switch (msg.message_type) {
          case "session_started":
            onStatus("Listening");
            settle(resolve);
            return;
          case "partial_transcript":
            if (msg.text !== undefined) onUpdate({ segmentId, text: msg.text, isFinal: false });
            return;
          case "committed_transcript":
          case "committed_transcript_with_timestamps":
            if (msg.text !== undefined) onUpdate({ segmentId, text: msg.text, isFinal: true });
            segmentId = this.nextSegmentId();
            return;
          default: {
            const fatal = FATAL_MESSAGE_TYPES.has(msg.message_type);
            onStatus(`${fatal ? "denied" : "error"}: ${msg.message_type}${msg.error ? `: ${msg.error}` : ""}`);
            settle(() => reject(new Error(msg.message_type)));
          }
        }
      };
      ws.onerror = () => {
        settle(() => reject(new Error("ElevenLabs WebSocket error")));
        onStatus("error: connection error");
      };
      ws.onclose = () => {
        settle(() => reject(new Error("ElevenLabs WebSocket closed before the session started")));
        if (this.running) onStatus("error: connection closed");
      };
    });

    this.unsubscribeMic = this.mic.onChunk((pcm) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: int16ToBase64(pcm),
          commit: false,
          sample_rate: 16000,
        }),
      );
    });
  }

  stop(): void {
    this.running = false;
    this.unsubscribeMic?.();
    this.unsubscribeMic = null;
    this.mic.stop();
    this.ws?.close();
    this.ws = null;
  }

  private nextSegmentId(): string {
    this.segmentIndex += 1;
    return `el-${this.segmentIndex}`;
  }
}

/** Base64-encodes PCM samples in chunks, so a long buffer doesn't overflow the call stack via `String.fromCharCode(...bytes)`. */
function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
