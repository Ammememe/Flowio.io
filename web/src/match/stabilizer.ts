// P0-5/P4-2: stability rules. Turns noisy per-bullet scores into a calm highlight.
//
//  1. Confidence threshold: a bullet must score at least `enter` and beat the runner-up by `margin`.
//  2. Confirmation: it must stay the winner for `confirmMs` before the highlight moves.
//  3. Minimum hold: once a bullet is highlighted it stays for at least `minHoldMs`.
//  4. Do nothing when unsure: no qualifying winner means the current highlight simply stays.
//  5. Release: if the highlighted bullet gets no support (score >= `exit`) for `releaseMs`,
//     the slide returns to neutral. This covers tangents and long pauses.
// Ported from the Phase 0 spike, unchanged.

export interface StabilizerConfig {
  enter: number;
  margin: number;
  exit: number;
  confirmMs: number;
  minHoldMs: number;
  releaseMs: number;
}

export class Stabilizer {
  active: string | null = null;
  private activeSince = 0;
  private lastSupport = 0;
  private candidate: string | null = null;
  private candidateSince = 0;

  constructor(private cfg: StabilizerConfig) {}

  reset(): void {
    this.active = null;
    this.candidate = null;
  }

  /** Feed the latest scores. Returns the bullet that should be highlighted now, or null. */
  update(rows: { id: string; score: number }[], now: number): string | null {
    const sorted = [...rows].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const runnerUp = sorted[1]?.score ?? 0;
    const qualifies = !!best && best.score >= this.cfg.enter && best.score - runnerUp >= this.cfg.margin;

    if (qualifies && best.id === this.active) {
      this.lastSupport = now;
      this.candidate = null;
    } else if (qualifies) {
      if (this.candidate !== best.id) {
        this.candidate = best.id;
        this.candidateSince = now;
      }
      const confirmed = now - this.candidateSince >= this.cfg.confirmMs;
      const holdOver = this.active === null || now - this.activeSince >= this.cfg.minHoldMs;
      if (confirmed && holdOver) {
        this.active = best.id;
        this.activeSince = now;
        this.lastSupport = now;
        this.candidate = null;
      }
    } else {
      this.candidate = null;
    }

    if (this.active !== null) {
      const activeScore = rows.find((r) => r.id === this.active)?.score ?? 0;
      if (activeScore >= this.cfg.exit) this.lastSupport = now;
      if (now - this.lastSupport >= this.cfg.releaseMs) this.active = null;
    }
    return this.active;
  }
}
