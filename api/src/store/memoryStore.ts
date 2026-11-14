import { randomUUID } from "node:crypto";
import type { Deck, NewDeck, UpdateDeck } from "@flowio/shared";
import { DeckNotFoundError, DeckVersionConflictError, type DeckStore } from "./deckStore.js";

/** In-memory DeckStore for local dev (`pnpm dev`) and unit tests. Not used in production. */
export class MemoryDeckStore implements DeckStore {
  private decks = new Map<string, Deck>();

  async createDeck(ownerId: string, input: NewDeck): Promise<Deck> {
    const now = new Date().toISOString();
    const deck: Deck = {
      ...input,
      id: randomUUID(),
      ownerId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.decks.set(deck.id, deck);
    return deck;
  }

  async getDeck(id: string, ownerId: string): Promise<Deck | undefined> {
    const deck = this.decks.get(id);
    return deck && deck.ownerId === ownerId ? deck : undefined;
  }

  async listDecks(ownerId: string): Promise<Deck[]> {
    return [...this.decks.values()]
      .filter((d) => d.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async updateDeck(id: string, ownerId: string, patch: UpdateDeck): Promise<Deck> {
    const existing = await this.getDeck(id, ownerId);
    if (!existing) throw new DeckNotFoundError();
    if (existing.version !== patch.expectedVersion) {
      throw new DeckVersionConflictError(existing.version);
    }
    const updated: Deck = {
      ...existing,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.themeId !== undefined && { themeId: patch.themeId }),
      ...(patch.language !== undefined && { language: patch.language }),
      ...(patch.slides !== undefined && { slides: patch.slides }),
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.decks.set(id, updated);
    return updated;
  }

  async deleteDeck(id: string, ownerId: string): Promise<boolean> {
    const existing = await this.getDeck(id, ownerId);
    if (!existing) return false;
    this.decks.delete(id);
    return true;
  }
}
