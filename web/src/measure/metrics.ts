// P0-7/P4-2: the two numbers the exit tests ask for: how late the highlight is, and how often it is wrong.
// Ported from the Phase 0 spike, unchanged.
//
// Ground truth comes from "markers": the moment the speaker starts on a bullet (a key press in live mode,
// automatic in replay). The matcher's highlight changes are logged next to them.
//
// Delay is reported two ways when the data allows it:
//  - from the start of the point, which includes any lead-in the speaker says first ("Let's move on to...")
//  - from the cue point, the first moment a listener could tell which bullet it is. No matcher can beat this one.

export type LogEvent =
  | { t: number; type: "marker"; slide: string; bullet: string | null; cueT?: number } // bullet null = off-topic
  | { t: number; type: "highlight"; slide: string; bullet: string | null } // bullet null = back to neutral
  | { t: number; type: "end" };

export interface DelayStats {
  delaysMs: number[];
  medianMs: number | null;
  p90Ms: number | null;
  /** Share of all marked bullets highlighted within 1.5 s. Misses count against it. */
  within1500: number;
}

export interface Metrics {
  /** Markers that pointed at a bullet. */
  bullets: number;
  hits: number;
  missed: number;
  /** Highlights of a bullet other than the one being talked about. */
  wrong: number;
  wrongPer10: number;
  fromStart: DelayStats;
  /** Only present when the markers carry cue points (the scripted replay). */
  fromCue: DelayStats | null;
  /** Proposed exit test, per delay definition: 90% of bullets within 1.5 s and at most 1 wrong highlight per 10. */
  passFromStart: boolean;
  passFromCue: boolean | null;
}

export const TARGET_DELAY_MS = 1500;
export const TARGET_WITHIN = 0.9;
export const TARGET_WRONG_PER_10 = 1;

function stats(delaysMs: number[], bullets: number): DelayStats {
  const sorted = [...delaysMs].sort((a, b) => a - b);
  const pick = (q: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] : null;
  return {
    delaysMs,
    medianMs: pick(0.5),
    p90Ms: pick(0.9),
    within1500: bullets ? sorted.filter((d) => d <= TARGET_DELAY_MS).length / bullets : 0,
  };
}

export function computeMetrics(events: LogEvent[]): Metrics {
  const ordered = [...events].sort((a, b) => a.t - b.t);
  const markers = ordered.filter((e) => e.type === "marker");
  const highlights = ordered.filter((e) => e.type === "highlight");
  const endT = ordered.length ? ordered[ordered.length - 1].t : 0;

  let bullets = 0;
  let wrong = 0;
  const fromStart: number[] = [];
  const fromCue: number[] = [];
  let hasCues = false;

  markers.forEach((marker, i) => {
    const t0 = marker.t;
    const t1 = markers[i + 1]?.t ?? endT + 1;
    const during = highlights.filter((h) => h.t >= t0 && h.t < t1);
    const before = highlights.filter((h) => h.t < t0);
    const shownAtStart = before.length ? before[before.length - 1].bullet : null;

    wrong += during.filter((h) => h.bullet !== null && h.bullet !== marker.bullet).length;
    if (marker.bullet === null) return;

    bullets++;
    if (marker.cueT !== undefined) hasCues = true;
    const hitT = shownAtStart === marker.bullet ? t0 : during.find((h) => h.bullet === marker.bullet)?.t;
    if (hitT === undefined) return;
    fromStart.push(hitT - t0);
    if (marker.cueT !== undefined) fromCue.push(Math.max(0, hitT - marker.cueT));
  });

  const wrongPer10 = bullets ? (wrong / bullets) * 10 : 0;
  const startStats = stats(fromStart, bullets);
  const cueStats = hasCues ? stats(fromCue, bullets) : null;
  const pass = (s: DelayStats) => bullets > 0 && s.within1500 >= TARGET_WITHIN && wrongPer10 <= TARGET_WRONG_PER_10;
  return {
    bullets,
    hits: fromStart.length,
    missed: bullets - fromStart.length,
    wrong,
    wrongPer10,
    fromStart: startStats,
    fromCue: cueStats,
    passFromStart: pass(startStats),
    passFromCue: cueStats ? pass(cueStats) : null,
  };
}

export function formatMetrics(m: Metrics): string {
  if (!m.bullets) return "No bullets marked yet.";
  const s = (v: number | null) => (v === null ? "n/a" : `${(v / 1000).toFixed(1)} s`);
  const line = (label: string, d: DelayStats) =>
    `${label}: median ${s(d.medianMs)}, 90th percentile ${s(d.p90Ms)}, ${Math.round(d.within1500 * 100)}% within 1.5 s`;
  const verdict = (ok: boolean) => (ok ? "PASS" : "not met");
  const out = [
    `${m.hits} of ${m.bullets} bullets highlighted, ${m.missed} missed`,
    `Wrong highlights: ${m.wrong} (${m.wrongPer10.toFixed(1)} per 10 bullets, target at most 1)`,
    line(m.fromCue ? "Delay from start of the point" : "Delay from marker", m.fromStart),
  ];
  if (m.fromCue) out.push(line("Delay from the cue point", m.fromCue));
  out.push(`Exit test${m.fromCue ? ", from start of the point" : ""}: ${verdict(m.passFromStart)}`);
  if (m.passFromCue !== null) out.push(`Exit test, from the cue point: ${verdict(m.passFromCue)}`);
  return out.join("\n");
}
