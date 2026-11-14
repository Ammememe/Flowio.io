// Replays a scripted talk through the matcher, word by word, as a speech recognizer would deliver it.
// Used for the on-screen replay (real time) and the instant benchmark (as fast as the machine allows).

import type { ScriptLine } from '../deck';
import type { Matcher, MatchState } from '../match/matcher';
import type { LogEvent } from './metrics';

export interface SimOptions {
  /** Speaking pace. 400 ms per word is about 150 words per minute. */
  msPerWord: number;
  /** Pause between passages. */
  gapMs: number;
  /** How often the matcher re-evaluates. */
  tickMs: number;
  /** Simulated recognizer lag: how long after a word is spoken its text arrives. */
  lagMs: number;
  /** Wait in real time so the result can be watched. */
  realtime: boolean;
  onState?: (state: MatchState, now: number) => void;
  onSlide?: (slideId: string) => void;
  onTranscript?: (text: string) => void;
  /** Set `cancelled = true` to stop a running replay. */
  control?: { cancelled: boolean };
}

export const DEFAULT_SIM: SimOptions = { msPerWord: 400, gapMs: 700, tickMs: 200, lagMs: 500, realtime: false };

type Step =
  | { t: number; kind: 'slide'; slide: string }
  | { t: number; kind: 'marker'; slide: string; bullet: string | null; cueT?: number }
  | { t: number; kind: 'words'; segment: string; text: string }
  | { t: number; kind: 'tick' };

const ORDER = { slide: 0, marker: 1, words: 2, tick: 3 } as const;

export async function simulateTalk(matcher: Matcher, script: ScriptLine[], opts: SimOptions): Promise<LogEvent[]> {
  const steps: Step[] = [];
  let t = 500;
  let slide = '';
  script.forEach((line, index) => {
    if (line.slide !== slide) {
      slide = line.slide;
      steps.push({ t, kind: 'slide', slide });
    }
    // A `|` marks the cue point: the moment the word before it has been spoken.
    const [lead, rest] = line.text.split('|');
    const cueWords = rest === undefined ? undefined : lead.trim().split(/\s+/).length;
    const cueT = cueWords === undefined ? undefined : t + cueWords * opts.msPerWord;
    steps.push({ t, kind: 'marker', slide, bullet: line.bullet, cueT });
    const words = line.text.replace('|', '').split(/\s+/);
    words.forEach((_, k) => {
      t += opts.msPerWord;
      steps.push({ t: t + opts.lagMs, kind: 'words', segment: `sim-${index}`, text: words.slice(0, k + 1).join(' ') });
    });
    t += opts.gapMs;
  });
  const endT = t + opts.lagMs + 2000;
  for (let tick = 0; tick <= endT; tick += opts.tickMs) steps.push({ t: tick, kind: 'tick' });
  steps.sort((a, b) => a.t - b.t || ORDER[a.kind] - ORDER[b.kind]);

  const events: LogEvent[] = [];
  let shown: string | null = null;
  let currentSlide = '';
  const wallStart = performance.now();
  matcher.reset();

  for (const step of steps) {
    if (opts.control?.cancelled) break;
    if (opts.realtime) {
      const wait = step.t - (performance.now() - wallStart);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
    if (step.kind === 'slide') {
      currentSlide = step.slide;
      matcher.setSlide(step.slide);
      if (shown !== null) {
        shown = null;
        events.push({ t: step.t, type: 'highlight', slide: step.slide, bullet: null });
      }
      opts.onSlide?.(step.slide);
    } else if (step.kind === 'marker') {
      events.push({ t: step.t, type: 'marker', slide: step.slide, bullet: step.bullet, cueT: step.cueT });
    } else if (step.kind === 'words') {
      matcher.onTranscript(step.segment, step.text, step.t);
      opts.onTranscript?.(step.text);
    } else {
      const state = await matcher.tick(step.t);
      if (!state) continue;
      if (state.active !== shown) {
        shown = state.active;
        events.push({ t: step.t, type: 'highlight', slide: currentSlide, bullet: shown });
      }
      opts.onState?.(state, step.t);
    }
  }
  events.push({ t: endT, type: 'end' });
  return events;
}
