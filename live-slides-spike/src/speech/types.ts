export interface TranscriptUpdate {
  /** Stable id for one utterance. The same id is sent again as the text grows or is revised. */
  segmentId: string;
  /** The full current text of that segment. */
  text: string;
  isFinal: boolean;
  /** Seconds of audio covered so far, when the provider reports it. */
  audioEnd?: number;
}

export interface TranscriptSource {
  readonly name: string;
  start(onUpdate: (u: TranscriptUpdate) => void, onStatus: (text: string) => void): Promise<void>;
  stop(): void;
}
