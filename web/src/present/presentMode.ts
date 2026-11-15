import type { Deck } from "@flowio/shared";
import { emphasisTargets } from "../match/targets.js";
import { exitSlide, renderSlide } from "../render/renderSlide.js";
import type { EmphasisState, RenderedSlide } from "../render/types.js";
import { themeA, themeB, themesById, type ThemeTokens } from "../themes/tokens.js";
import { createLiveEngine, type ListeningStatus } from "./liveEngine.js";

export interface PresenterHandlers {
  /** P4-5: a visible listening state -- mic on/off, following on/off, connection status. */
  onLiveStatusChange?(status: { micOn: boolean; following: boolean; listening: ListeningStatus; detail?: string }): void;
  /**
   * P4-6: called instead of flipping the mic directly when the presenter
   * asks to turn it on/off (the 'm' key, here, or a UI button calling the
   * same `Presenter.requestMicToggle`) -- lets the caller show the sound
   * check before the first "on". Defaults to flipping the mic immediately
   * if not provided.
   */
  onMicToggleRequested?(turnOn: boolean): void;
}

export interface Presenter {
  /** Flips the mic directly -- used by `onMicToggleRequested` once it's decided it's safe to. */
  setMicOn(on: boolean): void;
  /** What the 'm' key and a UI mic button should both call. */
  requestMicToggle(): void;
  setFollowing(on: boolean): void;
  readonly micOn: boolean;
  readonly following: boolean;
  destroy(): void;
}

/**
 * P2-7/P4-4/P4-5: present mode. Fullscreen, keyboard and clicker navigation
 * (clickers send PageUp/PageDown or arrow keys). Digit keys 1-9 emphasise
 * the nth emphasisable element on the current slide by hand -- manual
 * control always wins over the live engine (P4-5), which is why doing so
 * pauses live updates for a few seconds rather than being instantly
 * overwritten on the next tick.
 */
export function startPresenting(deck: Deck, container: HTMLElement, handlers: PresenterHandlers = {}): Presenter {
  let slideIndex = 0;
  let theme: ThemeTokens = themesById[deck.themeId] ?? themeA;
  let current: RenderedSlide = renderSlide(deck.slides[slideIndex], theme, container);
  let emphasis: EmphasisState = { activeElementId: null, intensity: 0 };
  let listening: ListeningStatus = "idle";
  let listeningDetail: string | undefined;

  const engine = createLiveEngine(deck, {
    onEmphasis(state) {
      setEmphasis(state);
    },
    onStatusChange(status, detail) {
      listening = status;
      listeningDetail = detail;
      reportStatus();
    },
  });
  engine.setSlide(deck.slides[slideIndex]);

  function reportStatus(): void {
    handlers.onLiveStatusChange?.({ micOn: engine.micOn, following: engine.following, listening, detail: listeningDetail });
  }

  function goTo(nextIndex: number, direction: 1 | -1): void {
    const clamped = Math.min(Math.max(nextIndex, 0), deck.slides.length - 1);
    if (clamped === slideIndex) return;
    slideIndex = clamped;
    emphasis = { activeElementId: null, intensity: 0 };
    const previous = current;
    void exitSlide(previous, theme, direction);
    current = renderSlide(deck.slides[slideIndex], theme, container);
    engine.setSlide(deck.slides[slideIndex]);
  }

  function setTheme(next: ThemeTokens): void {
    theme = next;
    current.destroy();
    current = renderSlide(deck.slides[slideIndex], theme, container);
    current.setEmphasis(emphasis);
  }

  function setEmphasis(state: EmphasisState): void {
    emphasis = state;
    current.setEmphasis(emphasis);
  }

  function manualSetEmphasis(state: EmphasisState): void {
    engine.notifyManualOverride(); // P4-5: manual control always wins
    setEmphasis(state);
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        event.preventDefault();
        goTo(slideIndex + 1, 1);
        return;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        event.preventDefault();
        goTo(slideIndex - 1, -1);
        return;
      case "f":
      case "F":
        toggleFullscreen();
        return;
      case "t":
      case "T":
        setTheme(theme.id === themeA.id ? themeB : themeA);
        return;
      case "m":
      case "M":
        presenter.requestMicToggle();
        return;
      case "g":
      case "G":
        presenter.setFollowing(!engine.following);
        return;
      case "0":
      case "Escape":
        manualSetEmphasis({ activeElementId: null, intensity: 0 });
        return;
      default: {
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
          const targets = emphasisTargets(deck.slides[slideIndex]);
          const target = targets[digit - 1];
          if (target) manualSetEmphasis({ activeElementId: target.id, intensity: 1 });
        }
      }
    }
  }

  window.addEventListener("keydown", onKeyDown);

  const presenter: Presenter = {
    get micOn() {
      return engine.micOn;
    },
    get following() {
      return engine.following;
    },
    setMicOn(on) {
      engine.setMicOn(on);
      reportStatus();
    },
    requestMicToggle() {
      const turnOn = !engine.micOn;
      if (handlers.onMicToggleRequested) handlers.onMicToggleRequested(turnOn);
      else presenter.setMicOn(turnOn);
    },
    setFollowing(on) {
      engine.setFollowing(on);
      reportStatus();
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      engine.destroy();
      current.destroy();
    },
  };

  return presenter;
}
