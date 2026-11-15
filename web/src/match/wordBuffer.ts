// Rolling transcript with an arrival time per word.
//
// Speech recognizers send the same segment many times while it grows and gets revised ("interim results").
// A word keeps the time its position first appeared, so "the last 5 seconds of speech" stays meaningful
// even though the text of a segment keeps being replaced.
// Ported from the Phase 0 spike (P4-2), unchanged.

interface TimedWord {
  w: string;
  t: number;
}

export class WordBuffer {
  private segments = new Map<string, TimedWord[]>(); // insertion order is speech order

  update(segmentId: string, text: string, now: number): void {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const prev = this.segments.get(segmentId) ?? [];
    this.segments.set(
      segmentId,
      words.map((w, i) => ({ w, t: i < prev.length ? prev[i].t : now })),
    );
  }

  /** Words that arrived within the last `ms` milliseconds, in spoken order. */
  window(now: number, ms: number): string {
    const out: string[] = [];
    for (const words of this.segments.values()) {
      for (const { w, t } of words) if (t >= now - ms) out.push(w);
    }
    return out.join(' ');
  }

  /** Drop segments whose newest word is older than `keepMs`. */
  prune(now: number, keepMs: number): void {
    for (const [id, words] of this.segments) {
      const newest = words.length ? words[words.length - 1].t : -Infinity;
      if (newest < now - keepMs) this.segments.delete(id);
    }
  }

  clear(): void {
    this.segments.clear();
  }
}
