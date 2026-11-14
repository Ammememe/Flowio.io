import type { Deck } from "@flowio/shared";
import { exitSlide, renderSlide } from "../render/renderSlide.js";
import type { EmphasisState, RenderedSlide } from "../render/types.js";
import { themeA, themeB, themesById, type ThemeTokens } from "../themes/tokens.js";

export interface Presenter {
  destroy(): void;
}

/**
 * P2-7: present mode. Fullscreen, keyboard and clicker navigation (clickers
 * send PageUp/PageDown or arrow keys). Also binds digit keys 1-9 to
 * emphasise the nth emphasisable element on the current slide and 0/Escape
 * to clear it -- a manual stand-in for the live matcher (Phase 4), and
 * exactly what the Phase 2 exit test checks by hand.
 */
export function startPresenting(deck: Deck, container: HTMLElement): Presenter {
  let slideIndex = 0;
  let theme: ThemeTokens = themesById[deck.themeId] ?? themeA;
  let current: RenderedSlide = renderSlide(deck.slides[slideIndex], theme, container);
  let emphasis: EmphasisState = { activeElementId: null, intensity: 0 };

  function goTo(nextIndex: number, direction: 1 | -1): void {
    const clamped = Math.min(Math.max(nextIndex, 0), deck.slides.length - 1);
    if (clamped === slideIndex) return;
    slideIndex = clamped;
    emphasis = { activeElementId: null, intensity: 0 };
    const previous = current;
    void exitSlide(previous, theme, direction);
    current = renderSlide(deck.slides[slideIndex], theme, container);
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

  function emphasisTargetIds(): string[] {
    return deck.slides[slideIndex].elements
      .filter((e) => e.type === "title" || e.type === "bullet")
      .map((e) => e.id);
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
      case "0":
      case "Escape":
        setEmphasis({ activeElementId: null, intensity: 0 });
        return;
      default: {
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
          const ids = emphasisTargetIds();
          const target = ids[digit - 1];
          if (target) setEmphasis({ activeElementId: target, intensity: 1 });
        }
      }
    }
  }

  window.addEventListener("keydown", onKeyDown);

  return {
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      current.destroy();
    },
  };
}
