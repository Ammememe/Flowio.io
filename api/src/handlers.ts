import {
  newDeckSchema,
  summarizeDeck,
  updateDeckSchema,
  type Deck,
  type DeckSummary,
} from "@flowio/shared";
import type { AuthContext } from "./auth/types.js";
import { logger } from "./logger.js";
import { DeckNotFoundError, DeckVersionConflictError, type DeckStore } from "./store/deckStore.js";

/**
 * Business logic for the deck API (P1-6 hello world, extended P3-2/P3-8),
 * kept free of any HTTP or Lambda types so it can run under API Gateway,
 * the local dev server, and tests unchanged. Lambda adapters
 * (`src/lambda/*.ts`) translate to/from this.
 */

export type HandlerResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string; issues?: unknown };

function unauthorized<T>(): HandlerResult<T> {
  return { ok: false, status: 401, error: "Missing or invalid Authorization header" };
}

export async function createDeck(
  store: DeckStore,
  auth: AuthContext | null,
  rawBody: unknown,
): Promise<HandlerResult<Deck>> {
  if (!auth) return unauthorized();

  const parsed = newDeckSchema.safeParse(rawBody);
  if (!parsed.success) {
    logger.warn("createDeck: invalid deck", { issues: parsed.error.issues });
    return {
      ok: false,
      status: 400,
      error: "Deck failed schema validation",
      issues: parsed.error.issues,
    };
  }

  const deck = await store.createDeck(auth.userId, parsed.data);
  logger.info("createDeck: created", { deckId: deck.id, ownerId: auth.userId });
  return { ok: true, status: 201, body: deck };
}

export async function getDeck(
  store: DeckStore,
  auth: AuthContext | null,
  id: string,
): Promise<HandlerResult<Deck>> {
  if (!auth) return unauthorized();
  if (!id) return { ok: false, status: 400, error: "Missing deck id" };

  const deck = await store.getDeck(id, auth.userId);
  if (!deck) {
    logger.info("getDeck: not found", { deckId: id });
    return { ok: false, status: 404, error: "Deck not found" };
  }

  return { ok: true, status: 200, body: deck };
}

export async function listDecks(
  store: DeckStore,
  auth: AuthContext | null,
): Promise<HandlerResult<DeckSummary[]>> {
  if (!auth) return unauthorized();
  const decks = await store.listDecks(auth.userId);
  return { ok: true, status: 200, body: decks.map(summarizeDeck) };
}

export async function updateDeck(
  store: DeckStore,
  auth: AuthContext | null,
  id: string,
  rawBody: unknown,
): Promise<HandlerResult<Deck>> {
  if (!auth) return unauthorized();
  if (!id) return { ok: false, status: 400, error: "Missing deck id" };

  const parsed = updateDeckSchema.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Update failed schema validation", issues: parsed.error.issues };
  }

  try {
    const deck = await store.updateDeck(id, auth.userId, parsed.data);
    return { ok: true, status: 200, body: deck };
  } catch (err) {
    if (err instanceof DeckNotFoundError) {
      return { ok: false, status: 404, error: "Deck not found" };
    }
    if (err instanceof DeckVersionConflictError) {
      logger.info("updateDeck: version conflict", { deckId: id, currentVersion: err.currentVersion });
      return {
        ok: false,
        status: 409,
        error: "Deck was changed elsewhere since you last loaded it",
        issues: { currentVersion: err.currentVersion },
      };
    }
    throw err;
  }
}

export async function deleteDeck(
  store: DeckStore,
  auth: AuthContext | null,
  id: string,
): Promise<HandlerResult<null>> {
  if (!auth) return unauthorized();
  if (!id) return { ok: false, status: 400, error: "Missing deck id" };

  const deleted = await store.deleteDeck(id, auth.userId);
  if (!deleted) return { ok: false, status: 404, error: "Deck not found" };
  return { ok: true, status: 204, body: null };
}
