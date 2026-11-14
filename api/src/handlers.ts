import { newDeckSchema, type Deck } from "@live-slides/shared";
import { logger } from "./logger.js";
import type { DeckStore } from "./store/deckStore.js";

/**
 * Business logic for the P1-6 hello world, kept free of any HTTP or Lambda
 * types so it can run under API Gateway, the local dev server, and tests
 * unchanged. Lambda adapters (`src/lambda/*.ts`) translate to/from this.
 */

export type HandlerResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string; issues?: unknown };

export async function createDeck(
  store: DeckStore,
  rawBody: unknown,
): Promise<HandlerResult<Deck>> {
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

  const deck = await store.createDeck(parsed.data);
  logger.info("createDeck: created", { deckId: deck.id });
  return { ok: true, status: 201, body: deck };
}

export async function getDeck(
  store: DeckStore,
  id: string,
): Promise<HandlerResult<Deck>> {
  if (!id) {
    return { ok: false, status: 400, error: "Missing deck id" };
  }

  const deck = await store.getDeck(id);
  if (!deck) {
    logger.info("getDeck: not found", { deckId: id });
    return { ok: false, status: 404, error: "Deck not found" };
  }

  logger.info("getDeck: found", { deckId: id });
  return { ok: true, status: 200, body: deck };
}
