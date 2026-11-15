import type { Deck, Slide } from "@flowio/shared";
import { createLastBulletTracker } from "./lastBulletTracker.js";
import { createVoiceAnalyzer } from "./voiceAnalyzer.js";
import { DEFAULT_CONFIG, Matcher } from "../match/matcher.js";
import { emphasisTargets } from "../match/targets.js";
import { loadWorkerEmbedder, MODELS, type WorkerEmbedder } from "../match/workerEmbedder.js";
import type { EmphasisState } from "../render/types.js";
import { ElevenLabsSource } from "../speech/elevenLabsSource.js";
import { WebSpeechSource, webSpeechSupported } from "../speech/webSpeech.js";
import type { TranscriptSource } from "../speech/types.js";

/**
 * P4-5: the listening state the presenter (and P4-7's silent fallback) can be in.
 * "unsupported"/"denied" are terminal for this session; "reconnecting" is P4-7's
 * silent retry after a dropped connection, with no on-screen error.
 */
export type ListeningStatus = "idle" | "starting" | "listening" | "reconnecting" | "unsupported" | "denied";

export interface LiveEngineHandlers {
  onEmphasis(state: EmphasisState): void;
  onStatusChange(status: ListeningStatus, detail?: string): void;
  /** P6-7: raw transcript text for an on-screen captions overlay -- independent of `following`, so captions keep moving even while emphasis is paused. */
  onTranscript?(text: string, isFinal: boolean): void;
  /** P6-6: fires once per slide, when the last bullet has been the confident match for a sustained moment. Opt-in at the caller -- the engine always computes it, `presentMode.ts` decides whether to act on it. */
  onLastBulletDone?(): void;
  /** P6-3/P6-4: the voice analyzer's state, while it's running (see `setVoiceAnalyzerOn`). */
  onVoiceAnalyzerChange?(score: number, calibrating: boolean): void;
  /** The analyzer's own `getUserMedia` call failed (e.g. permission denied) -- it stays off; nothing else about the mic/matcher is affected. */
  onVoiceAnalyzerError?(message: string): void;
}

export interface LiveEngine {
  readonly micOn: boolean;
  readonly following: boolean;
  setSlide(slide: Slide): void;
  setMicOn(on: boolean): void;
  /** P4-6: which input device ElevenLabs captures from (the sound check's choice). No effect on the Web Speech fallback, which always uses the system default. */
  setPreferredDeviceId(deviceId: string | undefined): void;
  setFollowing(on: boolean): void;
  /** P4-5: manual control always wins -- call this whenever the presenter overrides the highlight by hand. */
  notifyManualOverride(): void;
  /** P6-5: on/off for the voice analyzer -- runs (and its score modulates emphasis intensity) only while this AND the mic are both on. Off by default (P6-3's doc comment explains why). */
  setVoiceAnalyzerOn(on: boolean): void;
  readonly voiceAnalyzerOn: boolean;
  destroy(): void;
}

const TICK_MS = 250;
const MANUAL_OVERRIDE_MS = 4000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
/** P6-6: how long the last bullet must stay the confident match before suggesting "advance". */
const LAST_BULLET_HOLD_MS = 3000;

/**
 * P4-4: wires the matcher (P4-2) up to the emphasis interface (P2-6) via a
 * transcription source (P4-1 -- ElevenLabs Scribe, falling back to the Web
 * Speech API if it's unavailable; see elevenLabsSource.ts). This is the
 * whole "bullet highlights as you talk" feature.
 */
export function createLiveEngine(deck: Deck, handlers: LiveEngineHandlers): LiveEngine {
  let embedder: WorkerEmbedder | null = null;
  let matcher: Matcher | null = null;
  let source: TranscriptSource | null = null;
  let micOn = false;
  let following = true;
  let manualUntil = 0;
  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectAttempts = 0;
  let destroyed = false;
  let lastEmphasis: EmphasisState = { activeElementId: null, intensity: 0 };
  let currentSlideId = deck.slides[0].id;
  let preferredDeviceId: string | undefined;
  // P6-6: id of the current slide's last emphasisable element.
  let lastTargetId = lastTargetIdFor(currentSlideId);
  const lastBulletTracker = createLastBulletTracker();

  // P6-3/P6-4/P6-5: opt-in loudness/pitch analyzer, independent of the mic
  // above (see voiceAnalyzer.ts for why it needs its own capture stream).
  let voiceAnalyzerOn = false;
  const voiceAnalyzer = createVoiceAnalyzer({
    onScoreChange: (score, calibrating) => handlers.onVoiceAnalyzerChange?.(score, calibrating),
  });

  function syncVoiceAnalyzer(): void {
    if (micOn && voiceAnalyzerOn) {
      voiceAnalyzer.start(preferredDeviceId).catch((err) => {
        handlers.onVoiceAnalyzerError?.(err instanceof Error ? err.message : String(err));
      });
    } else {
      voiceAnalyzer.stop();
    }
  }

  function lastTargetIdFor(slideId: string): string | null {
    const slide = deck.slides.find((s) => s.id === slideId);
    if (!slide) return null;
    const targets = emphasisTargets(slide);
    return targets.length > 0 ? targets[targets.length - 1].id : null;
  }

  // P4-3: embed titles/bullets/cues once the deck loads, in the background --
  // keyword-only matching still works while the model downloads (or if it
  // fails entirely), same fallback behaviour as the Phase 0 spike.
  const modelId = deck.language === "sv" ? MODELS[1].id : MODELS[0].id;
  const embedderReady = loadWorkerEmbedder(modelId, "wasm", () => {}).then(
    (e) => {
      embedder = e;
      return e;
    },
    () => null,
  );

  async function ensureMatcher(): Promise<Matcher> {
    if (matcher) return matcher;
    await embedderReady;
    if (destroyed) throw new Error("live engine destroyed");
    const m = new Matcher(deck, embedder, { ...DEFAULT_CONFIG });
    await m.prepare();
    // `setSlide` before this point was a no-op (there was no matcher yet) --
    // a `Matcher` defaults to deck.slides[0], which is wrong whenever the
    // presenter turns the mic on from any other slide. Apply the slide
    // that's actually current now that the matcher exists.
    m.setSlide(currentSlideId);
    matcher = m;
    return m;
  }

  function startTicking(): void {
    if (tickTimer) return;
    tickTimer = setInterval(() => void tick(), TICK_MS);
  }

  function stopTicking(): void {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }

  async function tick(): Promise<void> {
    if (!matcher || !following || destroyed) return;
    const now = performance.now();
    if (now < manualUntil) return; // P4-5: manual control always wins
    const result = await matcher.tick(now);
    if (!result || destroyed) return;
    const row = result.rows.find((r) => r.id === result.active);
    let intensity = row ? Math.max(0, Math.min(1, row.score)) : 0;
    // P6-5: vocal energy modulates how strongly an already-active bullet is
    // emphasised -- it never decides *which* bullet (that stays the
    // matcher's call, above), and it never lights up an inactive one
    // (intensity 0 stays 0 regardless of the multiplier).
    if (voiceAnalyzerOn && result.active) {
      intensity *= 0.7 + 0.3 * voiceAnalyzer.score;
    }
    lastEmphasis = { activeElementId: result.active, intensity };
    handlers.onEmphasis(lastEmphasis);

    // P6-6: the last bullet became (or stayed) the confident match -- once
    // it's held for a sustained moment, suggest moving on. Any other active
    // target resets the clock, so a brief, noisy mismatch can't trigger it.
    const isLastTargetActive = lastTargetId !== null && result.active === lastTargetId;
    if (lastBulletTracker.tick(now, isLastTargetActive, LAST_BULLET_HOLD_MS)) {
      handlers.onLastBulletDone?.();
    }
  }

  function scheduleReconnect(): void {
    // P4-7: fall back to manual control (the emphasis just stops updating)
    // silently -- no on-screen error -- then retry a few times.
    handlers.onStatusChange("reconnecting");
    if (!micOn || destroyed || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    reconnectAttempts += 1;
    setTimeout(() => {
      if (!micOn || destroyed) return;
      void startMic();
    }, RECONNECT_DELAY_MS);
  }

  function onTranscriptUpdate(update: { segmentId: string; text: string; isFinal: boolean }): void {
    reconnectAttempts = 0;
    matcher?.onTranscript(update.segmentId, update.text, performance.now());
    handlers.onTranscript?.(update.text, update.isFinal);
  }

  function onSourceStatus(status: string): void {
    if (status === "Listening") {
      handlers.onStatusChange("listening");
    } else if (status.startsWith("denied")) {
      micOn = false;
      handlers.onStatusChange("denied", status);
    } else if (status.startsWith("error")) {
      scheduleReconnect();
    }
  }

  /**
   * P4-1: ElevenLabs Scribe is the real transcription source -- low
   * latency, and it's our own API vending the short-lived credential, not a
   * raw key in the browser. If it's not configured server-side (no
   * ELEVENLABS_API_KEY) or the request fails for any reason, fall back to
   * the Web Speech API rather than failing the whole mic -- see
   * speech/webSpeech.ts for the tradeoff that makes.
   */
  async function startSource(): Promise<TranscriptSource> {
    try {
      const src = new ElevenLabsSource(deck.language === "sv" ? "sv" : "en", preferredDeviceId);
      await src.start(onTranscriptUpdate, onSourceStatus);
      return src;
    } catch (err) {
      if (!webSpeechSupported()) {
        throw new Error("This browser has no live speech recognition. Use Chrome or Edge.");
      }
      const lang = deck.language === "sv" ? "sv-SE" : "en-US";
      const src = new WebSpeechSource(lang);
      await src.start(onTranscriptUpdate, onSourceStatus);
      handlers.onStatusChange("listening", `ElevenLabs unavailable (${String(err)}), using Web Speech API`);
      return src;
    }
  }

  async function startMic(): Promise<void> {
    handlers.onStatusChange("starting");
    try {
      await ensureMatcher();
    } catch {
      return; // destroyed while loading
    }
    try {
      source = await startSource();
      micOn = true;
      startTicking();
    } catch (err) {
      micOn = false;
      handlers.onStatusChange(
        err instanceof Error && err.message.includes("no live speech recognition") ? "unsupported" : "denied",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  function stopMic(): void {
    micOn = false;
    source?.stop();
    source = null;
    stopTicking();
    handlers.onStatusChange("idle");
  }

  return {
    get micOn() {
      return micOn;
    },
    get following() {
      return following;
    },
    setSlide(slide) {
      currentSlideId = slide.id;
      lastTargetId = lastTargetIdFor(slide.id);
      lastBulletTracker.reset();
      matcher?.setSlide(slide.id);
    },
    setMicOn(on) {
      if (on === micOn) return;
      if (on) void startMic().then(syncVoiceAnalyzer);
      else {
        stopMic();
        syncVoiceAnalyzer();
      }
    },
    setPreferredDeviceId(deviceId) {
      preferredDeviceId = deviceId;
    },
    setFollowing(on) {
      // Pausing following leaves the current highlight exactly where it is --
      // it's the presenter choosing to take over, not a reason to clear it.
      following = on;
    },
    notifyManualOverride() {
      manualUntil = performance.now() + MANUAL_OVERRIDE_MS;
    },
    get voiceAnalyzerOn() {
      return voiceAnalyzerOn;
    },
    setVoiceAnalyzerOn(on) {
      voiceAnalyzerOn = on;
      syncVoiceAnalyzer();
    },
    destroy() {
      destroyed = true;
      stopMic();
      voiceAnalyzer.stop();
      void embedderReady.then((e) => e?.dispose());
    },
  };
}
