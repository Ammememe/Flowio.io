import { DECK_SCHEMA_VERSION, type NewDeck } from "@flowio/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createDeck, getDeck } from "../src/handlers.js";
import { MemoryDeckStore } from "../src/store/memoryStore.js";

function sampleNewDeck(): NewDeck {
  return {
    schemaVersion: DECK_SCHEMA_VERSION,
    title: "Airplanes",
    themeId: "theme-a",
    language: "en",
    slides: [
      {
        id: "slide_1",
        layout: "bullets",
        elements: [
          { id: "el_1", type: "bullet", text: "Lift comes from the wing shape", cues: [] },
        ],
      },
    ],
  };
}

describe("deck API handlers (P1-6 hello world)", () => {
  let store: MemoryDeckStore;

  beforeEach(() => {
    store = new MemoryDeckStore();
  });

  it("round-trips a deck through create then get, unchanged", async () => {
    const created = await createDeck(store, sampleNewDeck());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const fetched = await getDeck(store, created.body.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;

    expect(fetched.body).toEqual(created.body);
    expect(fetched.body.title).toBe("Airplanes");
  });

  it("rejects a deck that fails schema validation", async () => {
    const result = await createDeck(store, { title: "Missing required fields" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("returns 404 for an unknown deck id", async () => {
    const result = await getDeck(store, "does-not-exist");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});
