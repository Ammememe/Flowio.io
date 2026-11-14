import type { Deck, NewDeck } from "@live-slides/shared";

/**
 * Storage interface the handlers depend on, so the same handler logic runs
 * against an in-memory store (tests, local dev) and the real DynamoDB table
 * (deployed Lambda) without changing a line of business logic.
 */
export interface DeckStore {
  createDeck(input: NewDeck): Promise<Deck>;
  getDeck(id: string): Promise<Deck | undefined>;
}
