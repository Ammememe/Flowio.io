import { animate } from "motion";
import type { ThemeTokens } from "../themes/tokens.js";
import type { EmphasisState } from "./types.js";

/**
 * P2-6: the emphasis interface. Every emphasisable element in the slide
 * (anything with `data-element-id`) gets scaled/coloured relative to
 * `state`. Theme A (motionLevel 0) is a plain CSS transition -- "no motion
 * beyond simple fades" (P2-4). Theme B (motionLevel 1) animates the same
 * change through Motion (P2-5), so it can spring and ease differently.
 */
export function applyEmphasis(root: HTMLElement, state: EmphasisState, theme: ThemeTokens): void {
  const targets = root.querySelectorAll<HTMLElement>("[data-element-id]");

  for (const target of targets) {
    const isActive =
      state.activeElementId !== null && target.dataset.elementId === state.activeElementId;
    const intensity = state.activeElementId === null ? 0 : clamp01(state.intensity);

    const scale = isActive ? 1 + intensity * 0.06 : 1;
    const opacity =
      state.activeElementId === null ? 1 : isActive ? 1 : 1 - intensity * 0.65;
    const color = isActive
      ? theme.color.accent
      : state.activeElementId === null
        ? theme.color.foreground
        : theme.color.dim;

    if (theme.motionLevel === 0) {
      target.style.transition = "opacity 180ms ease, color 180ms ease, transform 180ms ease";
      target.style.opacity = String(opacity);
      target.style.color = color;
      target.style.transform = `scale(${scale})`;
    } else {
      void animate(
        target,
        { opacity, color, scale },
        { duration: 0.35, ease: isActive ? "easeOut" : "easeIn" },
      );
    }
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
