import type { Deck, DeckSummary, NewDeck, Slide } from "@flowio/shared";

/**
 * What `tools.ts` needs to actually store decks, independent of how a given
 * deployment gets there. `httpBackend.ts` (local testing: talks to the local
 * dev API, same as the web app) and `directBackend.ts` (deployed: talks to
 * DynamoDB directly, see its own doc comment for why) both implement this.
 */
export interface UpdateDeckInput {
  title?: string;
  themeId?: string;
  language?: "sv" | "en";
  slides?: Slide[];
  expectedVersion: number;
}

export interface DeckBackend {
  listDecks(): Promise<DeckSummary[]>;
  getDeck(id: string): Promise<Deck>;
  createDeck(input: NewDeck): Promise<Deck>;
  updateDeck(id: string, patch: UpdateDeckInput): Promise<Deck>;
}
