// P0-2: live transcript from the browser's built-in Web Speech API (Chrome and Edge).
import type { TranscriptSource, TranscriptUpdate } from './types';

export function webSpeechSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export class WebSpeechSource implements TranscriptSource {
  readonly name = 'Web Speech API';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private running = false;
  private session = 0;

  constructor(private lang: string) {}

  async start(onUpdate: (u: TranscriptUpdate) => void, onStatus: (text: string) => void): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) throw new Error('This browser has no Web Speech API. Use Chrome or Edge.');
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
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.running = false;
          onStatus('Microphone permission was denied.');
        } else {
          onStatus(`Speech recognition error: ${event.error}`);
        }
      };
      // Chrome ends a session after a pause or about a minute. Start a new one right away.
      rec.onend = () => {
        if (this.running) begin();
      };
      rec.onstart = () => onStatus('Listening');
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
