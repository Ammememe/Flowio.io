import type { Embedder } from '../src/match/scorer';
import { contentTokens } from '../src/match/text';

/**
 * Stand-in for a real embedding model: hashes word prefixes into a small vector.
 * Texts that share vocabulary end up close together. It exercises the embedding code path
 * (preparation, baselines, blending) but says nothing about real semantic quality.
 */
export class FakeEmbedder implements Embedder {
  readonly label = 'fake';
  calls = 0;

  async embed(texts: string[]): Promise<number[][]> {
    this.calls++;
    return texts.map((text) => {
      const vec = new Array<number>(64).fill(0);
      for (const tok of contentTokens(text)) {
        const key = tok.slice(0, 5);
        let h = 0;
        for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        vec[h % 64] += 1;
      }
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    });
  }
}
