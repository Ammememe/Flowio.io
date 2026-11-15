// The matcher: transcript in, "which bullet is being talked about" out.
// Pure logic with the clock passed in, so the same code runs live, in replay and in tests.
// Ported from the Phase 0 spike (P4-2) and adapted to the schema v1 Deck.

import type { Deck } from "@flowio/shared";
import { DeckScorer, type Embedder, type ScoreRow } from "./scorer.js";
import { Stabilizer } from "./stabilizer.js";
import { emphasisTargets } from "./targets.js";
import { WordBuffer } from "./wordBuffer.js";

export interface MatcherConfig {
  /** Long transcript window in ms. */
  fullWindowMs: number;
  /** Short, most recent transcript window in ms. */
  recentWindowMs: number;
  /** 0..1 share of the score taken from the recent window. */
  recentWeight: number;
  /** 0..1 share of the score taken from embeddings (the rest is keywords). */
  embWeight: number;
  /** Minimum score for a bullet to become highlighted. */
  enter: number;
  /** Minimum lead over the runner-up. */
  margin: number;
  /** A highlighted bullet scoring at least this still counts as "being talked about". */
  exit: number;
  /** How long a new winner must lead before the highlight moves. */
  confirmMs: number;
  /** Minimum time a highlight stays before it may move. */
  minHoldMs: number;
  /** Highlight fades to neutral after this long without support. */
  releaseMs: number;
  /** Small head start for the bullet after the last highlighted one, since speakers mostly go in order. */
  seqBonus: number;
  /** Match against cue phrases as well as the bullet text. */
  useCues: boolean;
}

// Starting values, carried over from the Phase 0 spike's keyword-only baseline
// (see live-slides-spike/README.md). Not yet re-tuned against a real embedding
// model in this codebase -- do that with real pilot sessions (P4-11).
export const DEFAULT_CONFIG: MatcherConfig = {
  fullWindowMs: 6000,
  recentWindowMs: 2500,
  recentWeight: 0.65,
  embWeight: 0.55,
  enter: 0.4,
  margin: 0.08,
  exit: 0.15,
  confirmMs: 300,
  minHoldMs: 1500,
  releaseMs: 7000,
  seqBonus: 0.04,
  useCues: true,
};

export interface MatchState {
  slideId: string;
  active: string | null;
  rows: ScoreRow[];
  recent: string;
  full: string;
}

export class Matcher {
  private buffer = new WordBuffer();
  private scorer: DeckScorer;
  private stabilizer: Stabilizer;
  private slideId: string;
  private lastActive: string | null = null;
  private busy = false;
  private cacheKey = "";
  private cacheRows: ScoreRow[] = [];

  constructor(
    private deck: Deck,
    embedder: Embedder | null,
    public config: MatcherConfig = { ...DEFAULT_CONFIG },
  ) {
    this.scorer = new DeckScorer(deck, embedder, config.useCues);
    this.stabilizer = new Stabilizer(config); // shares the config object, so live tuning applies at once
    this.slideId = deck.slides[0].id;
  }

  get usesEmbeddings(): boolean {
    return this.scorer.usesEmbeddings;
  }

  prepare(): Promise<void> {
    return this.scorer.prepare();
  }

  setSlide(slideId: string): void {
    if (slideId === this.slideId) return;
    this.slideId = slideId;
    this.lastActive = null;
    this.cacheKey = "";
    this.stabilizer.reset();
    // Words spoken about the previous slide should not score against the new one.
    this.buffer.clear();
  }

  reset(): void {
    this.buffer.clear();
    this.stabilizer.reset();
    this.lastActive = null;
    this.cacheKey = "";
  }

  /** Feed the current text of a transcript segment (interim or final). */
  onTranscript(segmentId: string, text: string, now: number): void {
    this.buffer.update(segmentId, text, now);
  }

  /** Re-evaluate. Call a few times per second. Returns null if the previous call is still running. */
  async tick(now: number): Promise<MatchState | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      const slideId = this.slideId;
      const recent = this.buffer.window(now, this.config.recentWindowMs);
      const full = this.buffer.window(now, this.config.fullWindowMs);
      this.buffer.prune(now, this.config.fullWindowMs * 2);

      const key = `${slideId}|${recent}|${full}|${this.config.recentWeight}|${this.config.embWeight}`;
      if (key !== this.cacheKey) {
        const rows = await this.scorer.score(slideId, recent, full, this.config);
        if (slideId !== this.slideId) return null; // slide changed while embedding
        this.cacheRows = rows;
        this.cacheKey = key;
      }

      const next = this.nextInOrder(slideId);
      const rows = this.cacheRows.map((r) =>
        r.id === next && r.score > 0 ? { ...r, score: r.score + this.config.seqBonus } : r,
      );
      const active = this.stabilizer.update(rows, now);
      if (active) this.lastActive = active;
      return { slideId, active, rows, recent, full };
    } finally {
      this.busy = false;
    }
  }

  private nextInOrder(slideId: string): string | null {
    const slide = this.deck.slides.find((s) => s.id === slideId);
    const targets = slide ? emphasisTargets(slide) : [];
    const i = targets.findIndex((t) => t.id === this.lastActive);
    return targets[i + 1]?.id ?? null; // i is -1 before anything was highlighted, so this is the first target
  }
}
