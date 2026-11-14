import { z } from "zod";

/**
 * Deck schema v1 (P1-2).
 *
 * This is the format every later phase builds on: the renderer (Phase 2),
 * the editor (Phase 3), the live matcher (Phase 4) and the MCP tools
 * (Phase 5) all read and write decks shaped like this.
 *
 * Keep changes additive where possible. If a change is not backward
 * compatible, bump `DECK_SCHEMA_VERSION` and add a migration before
 * removing support for the old version.
 */

export const DECK_SCHEMA_VERSION = 1 as const;

/** Six layout templates (P2-2). Fixed now so Phase 2/3 don't have to migrate decks later. */
export const layoutIds = [
  "title",
  "bullets",
  "bullets-image",
  "full-image",
  "quote",
  "section-break",
] as const;
export const layoutIdSchema = z.enum(layoutIds);
export type LayoutId = z.infer<typeof layoutIdSchema>;

/**
 * A "cue" is a short phrase the presenter is likely to say when they reach
 * this element. The live matcher (Phase 4) scores spoken text against cues
 * as well as the element's own text; Claude (Phase 5) is asked to write
 * two or three per bullet when it creates a deck.
 */
const cuesSchema = z.array(z.string().min(1)).max(10).default([]);

const elementIdSchema = z.string().min(1);

const titleElementSchema = z.object({
  id: elementIdSchema,
  type: z.literal("title"),
  text: z.string().min(1),
  cues: cuesSchema,
});

const bulletElementSchema = z.object({
  id: elementIdSchema,
  type: z.literal("bullet"),
  text: z.string().min(1),
  cues: cuesSchema,
});

const imageElementSchema = z.object({
  id: elementIdSchema,
  type: z.literal("image"),
  /** S3/CloudFront URL once uploads exist (P3-7). A placeholder string is fine before then. */
  src: z.string().min(1),
  alt: z.string().default(""),
  cues: cuesSchema,
});

export const elementSchema = z.discriminatedUnion("type", [
  titleElementSchema,
  bulletElementSchema,
  imageElementSchema,
]);
export type DeckElement = z.infer<typeof elementSchema>;

export const slideSchema = z.object({
  id: z.string().min(1),
  layout: layoutIdSchema,
  elements: z.array(elementSchema).default([]),
  /** Speaker notes land in Phase 6 (P6-1); reserved now so decks don't need a migration. */
  notes: z.string().optional(),
});
export type Slide = z.infer<typeof slideSchema>;

export const deckSchema = z.object({
  schemaVersion: z.literal(DECK_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  themeId: z.string().min(1),
  /** ISO 639-1. Swedish and English first (P4-8); kept here from v1 so decks always carry it. */
  language: z.enum(["sv", "en"]).default("en"),
  slides: z.array(slideSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Deck = z.infer<typeof deckSchema>;

/** Shape accepted when creating a deck: no id/timestamps yet, server assigns those. */
export const newDeckSchema = deckSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type NewDeck = z.infer<typeof newDeckSchema>;

export function parseDeck(value: unknown): Deck {
  return deckSchema.parse(value);
}

export function safeParseDeck(value: unknown) {
  return deckSchema.safeParse(value);
}
