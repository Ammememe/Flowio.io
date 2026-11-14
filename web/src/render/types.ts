/**
 * P2-6: the emphasis interface. This is the only thing the live engine
 * (Phase 4's matcher) will ever call on the renderer -- it doesn't know or
 * care about slides, layouts or themes, only "this element, this much".
 */
export interface EmphasisState {
  /** Element id to emphasise, or null to clear emphasis (every element neutral). */
  activeElementId: string | null;
  /** 0 (no emphasis yet) to 1 (fully confident). Ignored when activeElementId is null. */
  intensity: number;
}

/** Handle returned by `renderSlide`, used by present mode to drive emphasis and navigation. */
export interface RenderedSlide {
  root: HTMLElement;
  setEmphasis(state: EmphasisState): void;
  /** Tears down any running animations/listeners before the slide is replaced. */
  destroy(): void;
}
