import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Deck, NewDeck } from "@flowio/shared";
import type { DeckStore } from "./deckStore.js";

/**
 * Production DeckStore (P1-4/P1-6): one DynamoDB table, partition key `id`.
 * The whole deck is stored as a single item -- decks are small documents,
 * and Phase 3's autosave (P3-8) needs read-modify-write on one item anyway.
 */
export class DynamoDeckStore implements DeckStore {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName;
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async createDeck(input: NewDeck): Promise<Deck> {
    const now = new Date().toISOString();
    const deck: Deck = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: deck }),
    );
    return deck;
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    return result.Item as Deck | undefined;
  }
}
