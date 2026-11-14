// Keyword side of the matcher: which bullet's distinctive words did the speaker just say?
// This is the fast signal. A single distinctive word ("kerosene") can point at a bullet
// before there is enough speech for the embedding to be confident.

import { contentTokens, sameWord } from './text';

export interface WeightedToken {
  tok: string;
  /** 1 for a word only this bullet has, 1/2 if two bullets on the slide share it, and so on. */
  weight: number;
}

export interface KeywordTarget {
  id: string;
  tokens: WeightedToken[];
}

/** Build per-bullet keyword lists for one slide. Words shared between bullets count for less. */
export function buildKeywordTargets(bullets: { id: string; texts: string[] }[]): KeywordTarget[] {
  const perBullet = bullets.map((b) => {
    const unique: string[] = [];
    for (const tok of b.texts.flatMap(contentTokens)) {
      if (!unique.some((u) => sameWord(u, tok))) unique.push(tok);
    }
    return { id: b.id, toks: unique };
  });

  return perBullet.map(({ id, toks }) => ({
    id,
    tokens: toks.map((tok) => {
      const df = perBullet.filter((other) => other.toks.some((o) => sameWord(o, tok))).length;
      return { tok, weight: 1 / df };
    }),
  }));
}

/**
 * 0..1 score that saturates: one distinctive word is already decent evidence (about 0.57),
 * two are strong (0.81), and a pile of them cannot run away.
 */
export function keywordScore(target: KeywordTarget, windowTokens: string[], k = 1.2): number {
  if (!windowTokens.length) return 0;
  let matched = 0;
  for (const { tok, weight } of target.tokens) {
    if (windowTokens.some((w) => sameWord(w, tok))) matched += weight;
  }
  return 1 - Math.exp(-matched / k);
}
