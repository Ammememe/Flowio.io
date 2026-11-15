import type { Deck, Slide } from "@flowio/shared";
import { DEFAULT_CONFIG, Matcher } from "../match/matcher.js";
import { loadWorkerEmbedder, MODELS, type WorkerEmbedder } from "../match/workerEmbedder.js";
import type { EmphasisState } from "../render/types.js";
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
}

export interface LiveEngine {
  readonly micOn: boolean;
  readonly following: boolean;
  setSlide(slide: Slide): void;
  setMicOn(on: boolean): void;
  setFollowing(on: boolean): void;
  /** P4-5: manual control always wins -- call this whenever the presenter overrides the highlight by hand. */
  notifyManualOverride(): void;
  destroy(): void;
}

const TICK_MS = 250;
const MANUAL_OVERRIDE_MS = 4000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * P4-4: wires the matcher (P4-2) up to the emphasis interface (P2-6) via a
 * transcription source (P4-1 -- Web Speech API for now, see webSpeech.ts for
 * why). This is the whole "bullet highlights as you talk" feature.
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
    lastEmphasis = {
      activeElementId: result.active,
      intensity: row ? Math.max(0, Math.min(1, row.score)) : 0,
    };
    handlers.onEmphasis(lastEmphasis);
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

  async function startMic(): Promise<void> {
    if (!webSpeechSupported()) {
      micOn = false;
      handlers.onStatusChange("unsupported", "This browser has no live speech recognition. Use Chrome or Edge.");
      return;
    }
    handlers.onStatusChange("starting");
    try {
      await ensureMatcher();
    } catch {
      return; // destroyed while loading
    }
    const lang = deck.language === "sv" ? "sv-SE" : "en-US";
    const src = new WebSpeechSource(lang);
    source = src;
    try {
      await src.start(
        (update) => {
          reconnectAttempts = 0;
          matcher?.onTranscript(update.segmentId, update.text, performance.now());
        },
        (status) => {
          if (status === "Listening") {
            handlers.onStatusChange("listening");
          } else if (status.startsWith("denied")) {
            micOn = false;
            handlers.onStatusChange("denied", status);
          } else if (status.startsWith("error")) {
            scheduleReconnect();
          }
        },
      );
      micOn = true;
      startTicking();
    } catch (err) {
      micOn = false;
      handlers.onStatusChange("denied", err instanceof Error ? err.message : String(err));
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
      matcher?.setSlide(slide.id);
    },
    setMicOn(on) {
      if (on === micOn) return;
      if (on) void startMic();
      else stopMic();
    },
    setFollowing(on) {
      // Pausing following leaves the current highlight exactly where it is --
      // it's the presenter choosing to take over, not a reason to clear it.
      following = on;
    },
    notifyManualOverride() {
      manualUntil = performance.now() + MANUAL_OVERRIDE_MS;
    },
    destroy() {
      destroyed = true;
      stopMic();
      void embedderReady.then((e) => e?.dispose());
    },
  };
}
