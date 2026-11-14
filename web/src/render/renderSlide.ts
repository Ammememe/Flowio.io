import { animate, stagger } from "motion";
import type { Slide } from "@flowio/shared";
import { applyTheme } from "../themes/applyTheme.js";
import type { ThemeTokens } from "../themes/tokens.js";
import { el } from "./dom.js";
import { applyEmphasis } from "./emphasis.js";
import { layoutRenderers } from "./layouts/index.js";
import { fitStageToContainer, STAGE_HEIGHT, STAGE_WIDTH } from "./scale.js";
import type { EmphasisState, RenderedSlide } from "./types.js";

/**
 * P2-1: deck JSON + a theme becomes a 16:9 slide mounted into `container`,
 * scaled to fill it. Also runs the slide's entrance animation (P2-4/P2-5).
 */
export function renderSlide(
  slide: Slide,
  theme: ThemeTokens,
  container: HTMLElement,
): RenderedSlide {
  const stage = el("div", {
    class: "stage",
    attrs: { style: `width:${STAGE_WIDTH}px;height:${STAGE_HEIGHT}px;` },
  });
  applyTheme(stage, theme);

  const content = layoutRenderers[slide.layout](slide);
  stage.append(content);
  container.append(stage);

  const stopFitting = fitStageToContainer(stage, container);
  runEntrance(content, theme);

  let currentState: EmphasisState = { activeElementId: null, intensity: 0 };

  return {
    root: stage,
    setEmphasis(state: EmphasisState) {
      currentState = state;
      applyEmphasis(content, currentState, theme);
    },
    destroy() {
      stopFitting();
      stage.remove();
    },
  };
}

/** P2-4 (static): a simple fade in. P2-5 (animated): fade + rise, staggered per element. */
function runEntrance(content: HTMLElement, theme: ThemeTokens): void {
  if (theme.motionLevel === 0) {
    content.style.opacity = "0";
    content.style.transition = "opacity 220ms ease";
    requestAnimationFrame(() => {
      content.style.opacity = "1";
    });
    return;
  }

  const items = content.querySelectorAll<HTMLElement>("[data-element-id]");
  const targets = items.length > 0 ? Array.from(items) : [content];
  void animate(
    targets,
    { opacity: [0, 1], y: [16, 0] },
    { duration: 0.4, delay: stagger(0.06), ease: "easeOut" },
  );
}

/**
 * P2-5: slide transition -- animates `rendered` out before it's torn down.
 * Theme A just fades; Theme B fades and slides sideways.
 */
export function exitSlide(rendered: RenderedSlide, theme: ThemeTokens, direction: 1 | -1): Promise<void> {
  if (theme.motionLevel === 0) {
    rendered.root.style.transition = "opacity 160ms ease";
    rendered.root.style.opacity = "0";
    return wait(160).then(() => rendered.destroy());
  }

  return animate(
    rendered.root,
    { opacity: [1, 0], x: [0, -40 * direction] },
    { duration: 0.25, ease: "easeIn" },
  ).finished.then(() => rendered.destroy());
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
