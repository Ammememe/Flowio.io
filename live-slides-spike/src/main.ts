// Presenter page of the spike: slide on the left, controls and live diagnostics on the right.
// Throwaway UI code. The parts worth keeping live in src/match and src/measure.

import { DECKS, type Deck } from './deck';
import { DEFAULT_CONFIG, Matcher, type MatcherConfig, type MatchState } from './match/matcher';
import { MODELS, loadWorkerEmbedder, type WorkerEmbedder } from './match/workerEmbedder';
import { computeMetrics, formatMetrics, type LogEvent } from './measure/metrics';
import { DEFAULT_SIM, simulateTalk } from './measure/simulate';
import { flashMarker, renderSlide, setActiveBullet } from './render';
import { MicPcm } from './speech/micPcm';
import { ProxySource, fetchProxyHealth, type ProxyProvider } from './speech/proxySource';
import type { TranscriptSource, TranscriptUpdate } from './speech/types';
import { WebSpeechSource, webSpeechSupported } from './speech/webSpeech';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const deckSelect = $<HTMLSelectElement>('deck');
const modelSelect = $<HTMLSelectElement>('model');
const deviceSelect = $<HTMLSelectElement>('device');
const useCues = $<HTMLInputElement>('use-cues');
const modelStatus = $('model-status');
const sourceSelect = $<HTMLSelectElement>('source');
const startButton = $<HTMLButtonElement>('start');
const stopButton = $<HTMLButtonElement>('stop');
const speechStatus = $('speech-status');
const transcriptBox = $('transcript');
const scoresBox = $('scores');
const metricsBox = $('metrics');
const benchBox = $('bench');
const benchButton = $<HTMLButtonElement>('benchmark');
const simLag = $<HTMLInputElement>('sim-lag');
const slidersBox = $('sliders');

const config: MatcherConfig = { ...DEFAULT_CONFIG };
let deck: Deck = DECKS.en.deck;
let slideIndex = 0;
let embedder: WorkerEmbedder | null = null;
let matcher: Matcher | null = null;
let setupToken = 0;

type Mode = 'idle' | 'live' | 'replay';
let mode: Mode = 'idle';
let source: TranscriptSource | null = null;
let replayControl: { cancelled: boolean } | null = null;
let tickTimer: number | undefined;

let log: LogEvent[] = [];
let shown: string | null = null;

// ---------- Setup: deck, embedding model, matcher ----------

function setStatus(el: HTMLElement, text: string, isError = false): void {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function fillModelSelect(): void {
  modelSelect.replaceChildren(
    ...MODELS.map((m) => new Option(m.label, m.id)),
    new Option('None: keywords only', ''),
  );
}

function pickModelForDeck(): void {
  const current = MODELS.find((m) => m.id === modelSelect.value);
  if (modelSelect.value === '' || current?.languages.includes(deck.lang)) return;
  modelSelect.value = MODELS.find((m) => m.languages.includes(deck.lang))?.id ?? '';
}

async function setup(): Promise<void> {
  const token = ++setupToken;
  stopSpeech();
  matcher = null;
  embedder?.dispose();
  embedder = null;
  startButton.disabled = true;
  benchButton.disabled = true;

  deck = DECKS[deckSelect.value].deck;
  pickModelForDeck();
  slideIndex = 0;
  showSlide();
  resetLog();
  config.useCues = useCues.checked;

  let loadError = '';
  const modelId = modelSelect.value;
  if (modelId) {
    setStatus(modelStatus, 'Loading the embedding model…');
    try {
      const loaded = await loadWorkerEmbedder(modelId, deviceSelect.value as 'wasm' | 'webgpu', (text) => {
        if (token === setupToken) setStatus(modelStatus, text);
      });
      if (token !== setupToken) return loaded.dispose();
      embedder = loaded;
    } catch (err) {
      if (token !== setupToken) return;
      loadError = err instanceof Error ? err.message : String(err);
    }
  }

  let next = new Matcher(deck, embedder, config);
  try {
    await next.prepare();
  } catch (err) {
    // The model loaded but could not embed. Fall back the same way as a failed download.
    loadError = err instanceof Error ? err.message : String(err);
    embedder?.dispose();
    embedder = null;
    next = new Matcher(deck, null, config);
    await next.prepare();
  }
  if (token !== setupToken) return;

  matcher = next;
  matcher.setSlide(deck.slides[slideIndex].id);
  const texts = deck.slides.flatMap((s) => s.bullets).reduce((n, b) => n + 1 + (config.useCues ? (b.cues?.length ?? 0) : 0), 0);
  if (embedder) setStatus(modelStatus, `Ready. ${texts} bullet and cue texts embedded with ${embedder.label}.`);
  else if (loadError) setStatus(modelStatus, `The model could not be loaded (${loadError}). Matching on keywords only.`, true);
  else setStatus(modelStatus, 'Matching on keywords only.');
  startButton.disabled = false;
  benchButton.disabled = false;
}

// ---------- Slide and diagnostics ----------

function currentSlide() {
  return deck.slides[slideIndex];
}

function showSlide(): void {
  renderSlide(stage, deck, slideIndex);
  matcher?.setSlide(currentSlide().id);
  shown = null;
  scoresBox.replaceChildren(
    ...currentSlide().bullets.map((bullet, i) => {
      const row = document.createElement('div');
      row.className = 'score';
      row.dataset.id = bullet.id;
      row.innerHTML =
        `<span class="score-n">${i + 1}</span>` +
        '<div class="score-track"><div class="score-emb"></div><div class="score-kw"></div><div class="score-need"></div></div>' +
        '<span class="score-total">0.00</span>';
      return row;
    }),
  );
  placeThresholdMarks();
}

function placeThresholdMarks(): void {
  for (const mark of scoresBox.querySelectorAll<HTMLElement>('.score-need')) {
    mark.style.left = `${Math.min(100, config.enter * 100)}%`;
  }
}

function goToSlide(index: number): void {
  const clamped = Math.max(0, Math.min(deck.slides.length - 1, index));
  if (clamped === slideIndex) return;
  if (mode === 'live' && shown !== null) {
    log.push({ t: performance.now(), type: 'highlight', slide: currentSlide().id, bullet: null });
  }
  slideIndex = clamped;
  showSlide();
}

/** Paint a matcher result: highlight plus score bars. */
function showState(state: MatchState): void {
  if (state.slideId !== currentSlide().id) return;
  setActiveBullet(stage, state.active);
  const usesEmb = matcher?.usesEmbeddings ?? false;
  for (const row of state.rows) {
    const el = scoresBox.querySelector<HTMLElement>(`.score[data-id="${row.id}"]`);
    if (!el) continue;
    const embPart = usesEmb ? config.embWeight * row.emb : 0;
    const kwPart = usesEmb ? (1 - config.embWeight) * row.kw : row.kw;
    el.querySelector<HTMLElement>('.score-emb')!.style.width = `${Math.min(100, embPart * 100)}%`;
    el.querySelector<HTMLElement>('.score-kw')!.style.width = `${Math.min(100 - embPart * 100, kwPart * 100)}%`;
    el.querySelector<HTMLElement>('.score-total')!.textContent = row.score.toFixed(2);
    el.classList.toggle('active', row.id === state.active);
  }
}

// ---------- Live speech ----------

async function tick(): Promise<void> {
  if (mode !== 'live' || !matcher) return;
  const now = performance.now();
  const state = await matcher.tick(now);
  if (!state || mode !== 'live' || state.slideId !== currentSlide().id) return;
  if (state.active !== shown) {
    shown = state.active;
    log.push({ t: now, type: 'highlight', slide: state.slideId, bullet: shown });
    showMetrics();
  }
  showState(state);
}

function onTranscript(update: TranscriptUpdate): void {
  matcher?.onTranscript(update.segmentId, update.text, performance.now());
  transcriptBox.textContent = update.text.split(/\s+/).slice(-28).join(' ');
  void tick(); // react to new words at once instead of waiting for the next timer tick
}

function setRunning(next: Mode): void {
  mode = next;
  const running = next !== 'idle';
  startButton.disabled = running;
  stopButton.disabled = !running;
  benchButton.disabled = running;
  for (const el of [deckSelect, modelSelect, deviceSelect, sourceSelect, useCues]) el.disabled = running;
}

async function startSpeech(): Promise<void> {
  if (!matcher || mode !== 'idle') return;
  const kind = sourceSelect.value;
  resetLog();
  matcher.reset();
  if (kind === 'replay') return startReplay();

  source =
    kind === 'webspeech'
      ? new WebSpeechSource(deck.speechLang)
      : new ProxySource(kind as ProxyProvider, deck.speechLang, new MicPcm());
  setRunning('live');
  setStatus(speechStatus, 'Waiting for the microphone…');
  try {
    await source.start(onTranscript, (text) => setStatus(speechStatus, text));
  } catch (err) {
    stopSpeech();
    setStatus(speechStatus, err instanceof Error ? err.message : String(err), true);
    return;
  }
  tickTimer = window.setInterval(() => void tick(), 200);
}

async function startReplay(): Promise<void> {
  if (!matcher) return;
  const control = { cancelled: false };
  replayControl = control;
  setRunning('replay');
  setStatus(speechStatus, 'Replaying the sample talk in real time…');
  const events = await simulateTalk(matcher, DECKS[deckSelect.value].script, {
    ...DEFAULT_SIM,
    lagMs: Number(simLag.value) || 0,
    realtime: true,
    control,
    onSlide: (id) => {
      slideIndex = deck.slides.findIndex((s) => s.id === id);
      showSlide();
    },
    onTranscript: (text) => (transcriptBox.textContent = text.split(/\s+/).slice(-28).join(' ')),
    onState: showState,
  });
  if (replayControl !== control) return; // stopped or superseded
  replayControl = null;
  log = events;
  showMetrics();
  setRunning('idle');
  setStatus(speechStatus, control.cancelled ? 'Replay stopped.' : 'Replay finished. Results are under Measurement.');
}

function stopSpeech(): void {
  window.clearInterval(tickTimer);
  tickTimer = undefined;
  source?.stop();
  source = null;
  if (replayControl) {
    replayControl.cancelled = true;
    replayControl = null;
  }
  if (mode === 'live') {
    log.push({ t: performance.now(), type: 'end' });
    showMetrics();
  }
  if (mode !== 'idle') setStatus(speechStatus, 'Stopped.');
  setRunning('idle');
}

// ---------- Measurement ----------

function resetLog(): void {
  log = [];
  shown = null;
  setActiveBullet(stage, null);
  showMetrics();
}

function showMetrics(): void {
  metricsBox.textContent = formatMetrics(computeMetrics(log));
}

function mark(bulletNumber: number): void {
  if (mode !== 'live') return;
  const slide = currentSlide();
  const bullet = bulletNumber === 0 ? null : slide.bullets[bulletNumber - 1]?.id;
  if (bullet === undefined) return;
  log.push({ t: performance.now(), type: 'marker', slide: slide.id, bullet });
  flashMarker(stage, bullet);
  showMetrics();
}

function describeRun(): Record<string, unknown> {
  return {
    deck: deck.id,
    embedder: embedder?.label ?? 'none (keywords only)',
    embedMsAvg: embedder ? Math.round(embedder.avgMs * 10) / 10 : null,
    config: { ...config },
  };
}

function exportLog(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    ...describeRun(),
    source: sourceSelect.value,
    metrics: computeMetrics(log),
    events: log,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `live-slides-spike-${deck.id}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Replay the sample talk as fast as the machine allows, with the current settings, and print the numbers. */
async function runBenchmark(): Promise<void> {
  if (mode !== 'idle') return;
  benchButton.disabled = true;
  benchBox.hidden = false;
  benchBox.textContent = 'Running…';
  try {
    const lagMs = Number(simLag.value) || 0;
    const bench = new Matcher(deck, embedder, { ...config });
    await bench.prepare();
    const started = performance.now();
    const events = await simulateTalk(bench, DECKS[deckSelect.value].script, { ...DEFAULT_SIM, lagMs });
    const took = ((performance.now() - started) / 1000).toFixed(1);
    benchBox.textContent =
      `${formatMetrics(computeMetrics(events))}\n\n` +
      `Sample talk, ${embedder?.label ?? 'keywords only'}, simulated lag ${lagMs} ms.\n` +
      (embedder ? `One embedding call takes about ${embedder.avgMs.toFixed(0)} ms here. ` : '') +
      `Ran in ${took} s.`;
  } catch (err) {
    benchBox.textContent = `Benchmark failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    benchButton.disabled = mode !== 'idle';
  }
}

// ---------- Tuning sliders ----------

const SLIDERS: { key: Exclude<keyof MatcherConfig, 'useCues'>; label: string; min: number; max: number; step: number; ms?: boolean }[] = [
  { key: 'enter', label: 'Confidence needed to highlight', min: 0.1, max: 0.9, step: 0.01 },
  { key: 'margin', label: 'Lead over the runner-up', min: 0, max: 0.4, step: 0.01 },
  { key: 'confirmMs', label: 'Confirm time', min: 0, max: 1500, step: 50, ms: true },
  { key: 'minHoldMs', label: 'Minimum hold', min: 0, max: 6000, step: 100, ms: true },
  { key: 'releaseMs', label: 'Release after no support', min: 1000, max: 20000, step: 500, ms: true },
  { key: 'exit', label: 'Still-on-topic level', min: 0, max: 0.6, step: 0.01 },
  { key: 'recentWindowMs', label: 'Recent window', min: 1000, max: 6000, step: 250, ms: true },
  { key: 'fullWindowMs', label: 'Long window', min: 3000, max: 15000, step: 500, ms: true },
  { key: 'recentWeight', label: 'Weight of recent words', min: 0, max: 1, step: 0.05 },
  { key: 'embWeight', label: 'Embeddings (1) vs keywords (0)', min: 0, max: 1, step: 0.05 },
  { key: 'seqBonus', label: 'Next-in-order bonus', min: 0, max: 0.2, step: 0.01 },
];

function buildSliders(): void {
  slidersBox.replaceChildren(
    ...SLIDERS.map((spec) => {
      const wrap = document.createElement('label');
      wrap.className = 'slider';
      const name = document.createElement('span');
      name.textContent = spec.label;
      const value = document.createElement('output');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      const paint = () => (value.textContent = spec.ms ? `${config[spec.key]} ms` : config[spec.key].toFixed(2));
      input.value = String(config[spec.key]);
      paint();
      input.addEventListener('input', () => {
        config[spec.key] = Number(input.value); // the matcher reads this object live
        paint();
        placeThresholdMarks();
      });
      wrap.append(name, value, input);
      return wrap;
    }),
  );
}

// ---------- Wiring ----------

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (target.matches('input, select, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') goToSlide(slideIndex + 1);
  else if (event.key === 'ArrowLeft' || event.key === 'PageUp') goToSlide(slideIndex - 1);
  else if (/^[0-9]$/.test(event.key)) mark(Number(event.key));
  else if (event.key.toLowerCase() === 'h') document.body.classList.toggle('panel-hidden');
  else return;
  event.preventDefault();
});

startButton.addEventListener('click', () => void startSpeech());
stopButton.addEventListener('click', stopSpeech);
$('reset-log').addEventListener('click', resetLog);
$('export-log').addEventListener('click', exportLog);
benchButton.addEventListener('click', () => void runBenchmark());
$('reset-config').addEventListener('click', () => {
  Object.assign(config, DEFAULT_CONFIG, { useCues: useCues.checked });
  buildSliders();
  placeThresholdMarks();
});
for (const el of [deckSelect, modelSelect, deviceSelect, useCues]) el.addEventListener('change', () => void setup());

async function init(): Promise<void> {
  fillModelSelect();
  buildSliders();
  if (!('gpu' in navigator)) deviceSelect.querySelector<HTMLOptionElement>('[value="webgpu"]')!.disabled = true;
  if (!webSpeechSupported()) {
    sourceSelect.querySelector<HTMLOptionElement>('[value="webspeech"]')!.disabled = true;
    sourceSelect.value = 'replay';
    setStatus(speechStatus, 'This browser has no built-in speech recognition. Use Chrome or Edge for the microphone.');
  }
  void fetchProxyHealth().then((health) => {
    for (const provider of ['deepgram', 'transcribe'] as const) {
      const option = sourceSelect.querySelector<HTMLOptionElement>(`[value="${provider}"]`)!;
      option.disabled = !health?.[provider];
      if (option.disabled) option.textContent += health ? ': not configured' : ': proxy not running';
    }
  });
  await setup();
}

void init();
