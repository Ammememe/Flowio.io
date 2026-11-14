// P0-8: run several transcription providers on the same microphone and compare delay and accuracy.

import { DECKS } from './deck';
import { wordErrorRate } from './measure/wer';
import { MicPcm } from './speech/micPcm';
import { ProxySource, fetchProxyHealth } from './speech/proxySource';
import type { TranscriptSource, TranscriptUpdate } from './speech/types';
import { WebSpeechSource, webSpeechSupported } from './speech/webSpeech';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const langSelect = $<HTMLSelectElement>('lang');
const providersBox = $('providers');
const startButton = $<HTMLButtonElement>('start');
const stopButton = $<HTMLButtonElement>('stop');
const statusLine = $('status');
const referenceBox = $('reference');
const resultsBody = $('results');

/** Above this microphone level (RMS, 0..1) a chunk counts as speech. */
const SPEECH_LEVEL = 0.02;
/** This much quiet before speech makes it a new "start of speaking". */
const QUIET_MS = 700;

interface Lane {
  key: string;
  label: string;
  source: TranscriptSource;
  segments: Map<string, string>;
  /** Segments that already existed when the current onset happened: their updates are not "first text". */
  knownAtOnset: Set<string>;
  pendingOnset: number | null;
  latencies: number[];
  note: string;
}

const mic = new MicPcm();
let lanes: Lane[] = [];
let repaintTimer: number | undefined;
let available: { key: string; label: string; enabled: boolean; why: string }[] = [];

function referenceText(): string {
  const { script } = DECKS[langSelect.value];
  return script
    .filter((line) => line.slide === 's1')
    .map((line) => line.text.replace('|', ''))
    .join(' ');
}

function showReference(): void {
  referenceBox.textContent = referenceText();
}

function heard(lane: Lane): string {
  return [...lane.segments.values()].join(' ');
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function repaint(): void {
  const reference = referenceText();
  resultsBody.replaceChildren(
    ...lanes.map((lane) => {
      const row = document.createElement('tr');
      const text = heard(lane);
      const first = median(lane.latencies);
      const cells: [string, string][] = [
        [lane.label, ''],
        [first === null ? 'n/a' : `${Math.round(first)} ms (${lane.latencies.length} sentences)`, 'num'],
        [text ? `${(wordErrorRate(reference, text) * 100).toFixed(1)}%` : 'n/a', 'num'],
        [lane.note || text, 'heard'],
      ];
      for (const [value, className] of cells) {
        const cell = document.createElement('td');
        cell.textContent = value;
        cell.className = className;
        row.append(cell);
      }
      return row;
    }),
  );
}

function onUpdate(lane: Lane, update: TranscriptUpdate): void {
  if (lane.pendingOnset !== null && update.text.trim() && !lane.knownAtOnset.has(update.segmentId)) {
    lane.latencies.push(performance.now() - lane.pendingOnset);
    lane.pendingOnset = null;
  }
  lane.segments.set(update.segmentId, update.text);
}

async function start(): Promise<void> {
  const lang = DECKS[langSelect.value].deck.speechLang;
  const chosen = [...providersBox.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.value);
  if (!chosen.length) {
    statusLine.textContent = 'Tick at least one provider.';
    return;
  }
  startButton.disabled = true;
  langSelect.disabled = true;
  statusLine.textContent = 'Waiting for the microphone…';

  try {
    await mic.start();
  } catch (err) {
    statusLine.textContent = `Microphone: ${err instanceof Error ? err.message : String(err)}`;
    startButton.disabled = false;
    langSelect.disabled = false;
    return;
  }

  lanes = chosen.map((key) => ({
    key,
    label: available.find((a) => a.key === key)!.label,
    source: key === 'webspeech' ? new WebSpeechSource(lang) : new ProxySource(key as 'deepgram' | 'transcribe', lang, mic, false),
    segments: new Map(),
    knownAtOnset: new Set(),
    pendingOnset: null,
    latencies: [],
    note: '',
  }));

  let lastLoud = -Infinity;
  mic.onChunk((_pcm, level) => {
    if (level < SPEECH_LEVEL) return;
    const now = performance.now();
    if (now - lastLoud > QUIET_MS) {
      const onset = now - 100; // the chunk that crossed the level started about 100 ms ago
      for (const lane of lanes) {
        lane.pendingOnset = onset;
        lane.knownAtOnset = new Set(lane.segments.keys());
      }
    }
    lastLoud = now;
  });

  await Promise.all(
    lanes.map((lane) =>
      lane.source
        .start(
          (update) => onUpdate(lane, update),
          (text) => {
            if (!/^Listening/.test(text)) lane.note = text;
          },
        )
        .catch((err) => {
          lane.note = err instanceof Error ? err.message : String(err);
        }),
    ),
  );

  stopButton.disabled = false;
  statusLine.textContent = 'Listening. Read the text, then press Stop.';
  repaintTimer = window.setInterval(repaint, 500);
}

function stop(): void {
  window.clearInterval(repaintTimer);
  for (const lane of lanes) lane.source.stop();
  mic.stop();
  repaint();
  startButton.disabled = false;
  stopButton.disabled = true;
  langSelect.disabled = false;
  statusLine.textContent = 'Stopped. Results are below.';
}

async function init(): Promise<void> {
  showReference();
  const health = await fetchProxyHealth();
  const proxyWhy = (ok: boolean | undefined) => (ok ? '' : health ? 'no credentials found' : 'run "npm run stt-proxy"');
  available = [
    { key: 'webspeech', label: 'Browser speech recognition', enabled: webSpeechSupported(), why: 'needs Chrome or Edge' },
    { key: 'deepgram', label: 'Deepgram', enabled: !!health?.deepgram, why: proxyWhy(health?.deepgram) },
    { key: 'transcribe', label: 'Amazon Transcribe', enabled: !!health?.transcribe, why: proxyWhy(health?.transcribe) },
  ];
  providersBox.replaceChildren(
    ...available.map((provider) => {
      const label = document.createElement('label');
      label.className = 'check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = provider.key;
      box.checked = provider.enabled;
      box.disabled = !provider.enabled;
      label.append(box, provider.enabled ? provider.label : `${provider.label} (${provider.why})`);
      return label;
    }),
  );
}

langSelect.addEventListener('change', showReference);
startButton.addEventListener('click', () => void start());
stopButton.addEventListener('click', stop);
void init();
