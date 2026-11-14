// Raw microphone audio as 16 kHz, 16-bit mono chunks. Needed by Deepgram and Amazon Transcribe
// (the Web Speech API takes the microphone by itself) and by the comparison page's speech-onset detector.

export type PcmListener = (pcm: Int16Array, rms: number) => void;

export class MicPcm {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private listeners = new Set<PcmListener>();

  get running(): boolean {
    return this.ctx !== null;
  }

  async start(): Promise<void> {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.ctx = new AudioContext({ sampleRate: 16000 });
    await this.ctx.audioWorklet.addModule('/pcm-worklet.js');
    const input = this.ctx.createMediaStreamSource(this.stream);
    const capture = new AudioWorkletNode(this.ctx, 'pcm-capture');
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const samples = event.data;
      const pcm = new Int16Array(samples.length);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        sum += s * s;
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const rms = Math.sqrt(sum / samples.length);
      for (const listener of this.listeners) listener(pcm, rms);
    };
    // A silent path to the output keeps the graph running in every browser.
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    input.connect(capture).connect(mute).connect(this.ctx.destination);
  }

  /** Subscribe to audio chunks (100 ms each). Returns an unsubscribe function. */
  onChunk(listener: PcmListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.listeners.clear();
  }
}
