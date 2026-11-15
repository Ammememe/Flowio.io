// P0-2/P4-1: live transcript from the browser's built-in Web Speech API (Chrome and Edge).
//
// This is the MVP's transcription source for now. Production-grade streaming via Amazon
// Transcribe (an API endpoint vending short-lived credentials, browser streams audio
// directly) is still open -- see the Phase 4 status note in the README for why: it needs
// the AWS event-stream wire protocol implemented in the browser, which needs real-mic
// verification this environment can't do safely. The `TranscriptSource` interface means
// swapping it in later doesn't touch the matcher, emphasis or presenter-controls code at all.
import type { TranscriptSource, TranscriptUpdate } from "./types.js";

export function webSpeechSupported(): boolean {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export class WebSpeechSource implements TranscriptSource {
  readonly name = "Web Speech API";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private running = false;
  private session = 0;

  constructor(private lang: string) {}

  async start(onUpdate: (u: TranscriptUpdate) => void, onStatus: (text: string) => void): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) throw new Error("This browser has no Web Speech API. Use Chrome or Edge.");
    this.running = true;

    const begin = () => {
      const session = ++this.session;
      const rec = new Ctor();
      rec.lang = this.lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          onUpdate({ segmentId: `ws-${session}-${i}`, text: result[0].transcript, isFinal: result.isFinal });
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          this.running = false;
          onStatus("denied: microphone permission was denied");
        } else {
          onStatus(`error: ${event.error}`);
        }
      };
      // Chrome ends a session after a pause or about a minute. Start a new one right away.
      rec.onend = () => {
        if (this.running) begin();
      };
      rec.onstart = () => onStatus("Listening");
      this.recognition = rec;
      rec.start();
    };
    begin();
  }

  stop(): void {
    this.running = false;
    this.recognition?.stop();
    this.recognition = null;
  }
}
