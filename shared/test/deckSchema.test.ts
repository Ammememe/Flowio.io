import { describe, expect, it } from "vitest";
import {
  DECK_SCHEMA_VERSION,
  newDeckSchema,
  parseDeck,
  safeParseDeck,
} from "../src/deckSchema.js";

function sampleDeck() {
  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    id: "deck_1",
    title: "Airplanes",
    themeId: "theme-a",
    language: "en" as const,
    slides: [
      {
        id: "slide_1",
        layout: "bullets" as const,
        elements: [
          {
            id: "el_1",
            type: "bullet" as const,
            text: "Lift comes from the wing shape",
            cues: ["how does lift work", "the wing shape"],
          },
        ],
      },
    ],
    createdAt: "2026-11-14T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
  };
}

describe("deck schema v1", () => {
  it("round-trips a valid deck unchanged", () => {
    const input = sampleDeck();
    const parsed = parseDeck(input);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(input);
  });

  it("defaults cues and language when omitted", () => {
    const input = sampleDeck();
    // @ts-expect-error -- intentionally omitting optional fields to test defaults
    delete input.language;
    // @ts-expect-error -- intentionally omitting optional fields to test defaults
    delete input.slides[0].elements[0].cues;
    const parsed = parseDeck(input);
    expect(parsed.language).toBe("en");
    expect(parsed.slides[0].elements[0]).toMatchObject({ cues: [] });
  });

  it("rejects a deck with the wrong schema version", () => {
    const input = { ...sampleDeck(), schemaVersion: 2 };
    const result = safeParseDeck(input);
    expect(result.success).toBe(false);
  });

  it("rejects an element with an unknown type", () => {
    const input = sampleDeck();
    input.slides[0].elements.push({
      // @ts-expect-error -- deliberately invalid for the test
      id: "el_2",
      type: "video",
      text: "nope",
    });
    const result = safeParseDeck(input);
    expect(result.success).toBe(false);
  });

  it("newDeckSchema accepts a deck without id or timestamps", () => {
    const { id, createdAt, updatedAt, ...rest } = sampleDeck();
    const result = newDeckSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });
});
