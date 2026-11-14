// P0-8: Deepgram and Amazon Transcribe, reached through the local proxy in server/stt-proxy.mjs.
// The proxy holds the credentials; this page only sends audio to localhost.

import type { MicPcm } from './micPcm';
import type { TranscriptSource, TranscriptUpdate } from './types';

export const PROXY_HOST = 'localhost:8787';
export type ProxyProvider = 'deepgram' | 'transcribe';

export interface ProxyHealth {
  deepgram: boolean;
  transcribe: boolean;
}

/** Which providers the local proxy can reach. Null when the proxy is not running. */
export async function fetchProxyHealth(): Promise<ProxyHealth | null> {
  try {
    const res = await fetch(`http://${PROXY_HOST}/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? ((await res.json()) as ProxyHealth) : null;
  } catch {
    return null;
  }
}

export class ProxySource implements TranscriptSource {
  readonly name: string;
  private ws: WebSocket | null = null;
  private unsubscribe: (() => void) | null = null;

  /** `ownsMic`: start and stop the microphone together with this source. */
  constructor(
    private provider: ProxyProvider,
    private lang: string,
    private mic: MicPcm,
    private ownsMic = true,
  ) {
    this.name = provider === 'deepgram' ? 'Deepgram' : 'Amazon Transcribe';
  }

  async start(onUpdate: (u: TranscriptUpdate) => void, onStatus: (text: string) => void): Promise<void> {
    if (this.ownsMic) await this.mic.start();
    const ws = new WebSocket(`ws://${PROXY_HOST}/stt/${this.provider}?lang=${encodeURIComponent(this.lang)}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`Could not reach the local proxy at ${PROXY_HOST}. Run "npm run stt-proxy".`));
    });
    onStatus(`Listening (${this.name})`);

    this.unsubscribe = this.mic.onChunk((pcm) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer as ArrayBuffer);
    });
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === 'transcript') onUpdate(msg as TranscriptUpdate);
      else if (msg.type === 'error') onStatus(`${this.name}: ${msg.message}`);
    };
    ws.onclose = () => {
      if (this.ws === ws) onStatus(`${this.name} connection closed.`);
    };
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    if (this.ownsMic) this.mic.stop();
  }
}
