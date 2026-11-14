import { randomUUID } from "node:crypto";
import type { Deck, NewDeck } from "@flowio/shared";
import type { DeckStore } from "./deckStore.js";

/** In-memory DeckStore for local dev (`pnpm dev`) and unit tests. Not used in production. */
export class MemoryDeckStore implements DeckStore {
  private decks = new Map<string, Deck>();

  async createDeck(input: NewDeck): Promise<Deck> {
    const now = new Date().toISOString();
    const deck: Deck = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.decks.set(deck.id, deck);
    return deck;
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    return this.decks.get(id);
  }
}
