import { VoiceBaseline } from "./voiceBaseline.js";

export interface VoiceAnalyzerHandlers {
  /** Fires on every reading (several times a second) once started. */
  onScoreChange?(score: number, calibrating: boolean): void;
}

export interface VoiceAnalyzer {
  readonly score: number;
  readonly calibrating: boolean;
  start(deviceId?: string): Promise<void>;
  stop(): void;
}

/** P6-4: how long a new speaker's own baseline is built before anything is scored against it. */
const CALIBRATION_MS = 30000;

/**
 * P6-3/P6-4/P6-5: a loudness/pitch analyzer, entirely independent of
 * whichever `TranscriptSource` is transcribing speech (ElevenLabs or the
 * Web Speech API fallback -- see `liveEngine.ts`). It needs its own
 * microphone capture because Web Speech captures audio internally and
 * never exposes it; running this alongside ElevenLabs (which also opens
 * its own stream for the same device) means two concurrent capture
 * streams, which browsers support fine.
 *
 * Deliberately opt-in (off by default, `presentMode.ts`'s 'v' key) rather
 * than started automatically whenever the mic is -- a second silent
 * `getUserMedia` stream the presenter didn't ask for would cut against the
 * "disclosed, not hidden" mic-consent stance the sound check already takes
 * (P4-10).
 */
export function createVoiceAnalyzer(handlers: VoiceAnalyzerHandlers = {}): VoiceAnalyzer {
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let baseline = new VoiceBaseline({ calibrationMs: CALIBRATION_MS });

  return {
    get score() {
      return baseline.score;
    },
    get calibrating() {
      return baseline.calibrating;
    },
    async start(deviceId) {
      if (ctx) return;
      baseline = new VoiceBaseline({ calibrationMs: CALIBRATION_MS });
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      ctx = new AudioContext({ sampleRate: 16000 });
      await ctx.audioWorklet.addModule("/voice-analysis-worklet.js");
      const input = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "voice-analysis");
      node.port.onmessage = (event: MessageEvent<{ rms: number; pitchHz: number | null }>) => {
        baseline.record(performance.now(), event.data.rms, event.data.pitchHz);
        handlers.onScoreChange?.(baseline.score, baseline.calibrating);
      };
      // A silent path to the output keeps the graph running in every browser.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      input.connect(node).connect(mute).connect(ctx.destination);
    },
    stop() {
      stream?.getTracks().forEach((track) => track.stop());
      void ctx?.close();
      ctx = null;
      stream = null;
    },
  };
}
