import type { Deck, NewDeck, UpdateDeck } from "@flowio/shared";

export class DeckNotFoundError extends Error {}
export class DeckVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super(`Deck was modified since version was read (now at ${currentVersion})`);
  }
}

/**
 * Storage interface the handlers depend on, so the same handler logic runs
 * against an in-memory store (tests, local dev) and the real DynamoDB table
 * (deployed Lambda) without changing a line of business logic.
 */
export interface DeckStore {
  createDeck(ownerId: string, input: NewDeck): Promise<Deck>;
  /** Returns undefined if the deck doesn't exist OR belongs to a different owner -- callers 404 either way (P3-2 owner-only access). */
  getDeck(id: string, ownerId: string): Promise<Deck | undefined>;
  listDecks(ownerId: string): Promise<Deck[]>;
  /**
   * P3-8: rejects with DeckVersionConflictError if `patch.expectedVersion`
   * doesn't match the stored version (another tab/device saved first).
   * Rejects with DeckNotFoundError if the deck doesn't exist or isn't owned by `ownerId`.
   */
  updateDeck(id: string, ownerId: string, patch: UpdateDeck): Promise<Deck>;
  /** Returns true if a deck owned by `ownerId` was deleted, false if there was nothing to delete. */
  deleteDeck(id: string, ownerId: string): Promise<boolean>;
}
