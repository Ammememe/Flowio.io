import type { Slide } from "@flowio/shared";

export interface EmphasisTarget {
  id: string;
  text: string;
  cues: string[];
}

/**
 * The elements the live engine (and manual digit-key emphasis in present
 * mode) can point at: titles and bullets, never images. Centralised here so
 * the matcher and the keyboard handler agree on exactly the same list.
 */
export function emphasisTargets(slide: Slide): EmphasisTarget[] {
  return slide.elements
    .filter((e) => e.type === "title" || e.type === "bullet")
    .map((e) => ({ id: e.id, text: e.text, cues: e.cues }));
}
