import { randomUUID } from "node:crypto";
import { layoutIdSchema, type DeckElement, type Slide } from "@flowio/shared";
import { z } from "zod";

/**
 * Input shapes for tool arguments (P5-5): looser than the stored schema --
 * callers never supply `id`s, the server mints them -- but layout and
 * element `type` are still validated against the real enum, so a bad value
 * comes back as a structured zod issue Claude can read and correct from.
 */

const cuesInput = z
  .array(z.string().min(1))
  .max(10)
  .optional()
  .describe(
    "2-3 short phrases the presenter might actually say when reaching this point " +
      "(e.g. for a bullet about lift: [\"wing shape\", \"faster air on top\", \"lower pressure\"]). " +
      "The live matcher scores spoken text against these as well as the text itself, so cues " +
      "matter most when the likely spoken wording differs from the bullet's written text.",
  );

export const elementInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), text: z.string().min(1), cues: cuesInput }),
  z.object({ type: z.literal("bullet"), text: z.string().min(1), cues: cuesInput }),
  z.object({
    type: z.literal("image"),
    src: z.string().min(1).describe("An uploaded image's URL, or a placeholder string."),
    alt: z.string().optional(),
    cues: cuesInput,
  }),
]);
export type ElementInput = z.infer<typeof elementInputSchema>;

export const slideInputSchema = z.object({
  layout: layoutIdSchema,
  elements: z.array(elementInputSchema).default([]),
  notes: z.string().optional(),
});
export type SlideInput = z.infer<typeof slideInputSchema>;

function toElement(input: ElementInput): DeckElement {
  const id = `el_${randomUUID().slice(0, 8)}`;
  const cues = input.cues ?? [];
  if (input.type === "image") {
    return { id, type: "image", src: input.src, alt: input.alt ?? "", cues };
  }
  return { id, type: input.type, text: input.text, cues };
}

export function toSlide(input: SlideInput): Slide {
  return {
    id: `slide_${randomUUID().slice(0, 8)}`,
    layout: input.layout,
    elements: input.elements.map(toElement),
    notes: input.notes,
  };
}
