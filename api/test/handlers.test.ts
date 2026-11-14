import { DECK_SCHEMA_VERSION, type NewDeck } from "@flowio/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthContext } from "../src/auth/types.js";
import { createDeck, deleteDeck, getDeck, listDecks, updateDeck } from "../src/handlers.js";
import { MemoryDeckStore } from "../src/store/memoryStore.js";

const alice: AuthContext = { userId: "user_alice", email: "alice@example.com" };
const bob: AuthContext = { userId: "user_bob", email: "bob@example.com" };

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

describe("deck API handlers (P1-6 hello world, P3-2 CRUD, P3-8 autosave)", () => {
  let store: MemoryDeckStore;

  beforeEach(() => {
    store = new MemoryDeckStore();
  });

  it("round-trips a deck through create then get, unchanged", async () => {
    const created = await createDeck(store, alice, sampleNewDeck());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const fetched = await getDeck(store, alice, created.body.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;

    expect(fetched.body).toEqual(created.body);
    expect(fetched.body.title).toBe("Airplanes");
    expect(fetched.body.ownerId).toBe(alice.userId);
    expect(fetched.body.version).toBe(1);
  });

  it("rejects a deck that fails schema validation", async () => {
    const result = await createDeck(store, alice, { title: "Missing required fields" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("returns 401 when there's no auth context", async () => {
    const result = await createDeck(store, null, sampleNewDeck());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
  });

  it("returns 404 for an unknown deck id", async () => {
    const result = await getDeck(store, alice, "does-not-exist");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("owner-only access: another user gets 404, not the deck", async () => {
    const created = await createDeck(store, alice, sampleNewDeck());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getDeck(store, bob, created.body.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("listDecks only returns the caller's own decks", async () => {
    await createDeck(store, alice, sampleNewDeck());
    await createDeck(store, alice, { ...sampleNewDeck(), title: "Second deck" });
    await createDeck(store, bob, sampleNewDeck());

    const result = await listDecks(store, alice);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toHaveLength(2);
    expect(result.body.every((d) => d.title !== undefined)).toBe(true);
  });

  it("updateDeck bumps the version and updates fields", async () => {
    const created = await createDeck(store, alice, sampleNewDeck());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateDeck(store, alice, created.body.id, {
      title: "Renamed",
      expectedVersion: 1,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.body.title).toBe("Renamed");
    expect(updated.body.version).toBe(2);
  });

  it("updateDeck returns 409 when expectedVersion is stale (two tabs race)", async () => {
    const created = await createDeck(store, alice, sampleNewDeck());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const firstSave = await updateDeck(store, alice, created.body.id, {
      title: "From tab A",
      expectedVersion: 1,
    });
    expect(firstSave.ok).toBe(true);

    const staleSave = await updateDeck(store, alice, created.body.id, {
      title: "From tab B",
      expectedVersion: 1, // tab B never saw tab A's save
    });
    expect(staleSave.ok).toBe(false);
    if (staleSave.ok) return;
    expect(staleSave.status).toBe(409);
  });

  it("deleteDeck removes the deck, only for its owner", async () => {
    const created = await createDeck(store, alice, sampleNewDeck());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deniedDelete = await deleteDeck(store, bob, created.body.id);
    expect(deniedDelete.ok).toBe(false);

    const result = await deleteDeck(store, alice, created.body.id);
    expect(result.ok).toBe(true);

    const fetchAfterDelete = await getDeck(store, alice, created.body.id);
    expect(fetchAfterDelete.ok).toBe(false);
  });
});
