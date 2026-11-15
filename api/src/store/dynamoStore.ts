import { randomUUID } from "node:crypto";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Deck, NewDeck, UpdateDeck } from "@flowio/shared";
import { DeckNotFoundError, DeckVersionConflictError, type DeckStore } from "./deckStore.js";

/**
 * Production DeckStore (P1-4/P1-6, extended P3-2/P3-8): one DynamoDB table,
 * partition key `id`, with a GSI on `ownerId` (projected `updatedAt`) for
 * the dashboard's list view. The whole deck is stored as a single item --
 * decks are small documents, and autosave (P3-8) needs read-modify-write on
 * one item anyway.
 */
export class DynamoDeckStore implements DeckStore {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly ownerIndexName: string;

  constructor(
    tableName: string,
    ownerIndexName = "ownerId-index",
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.tableName = tableName;
    this.ownerIndexName = ownerIndexName;
    // A deck's optional fields (e.g. a slide's `notes`) come through as
    // literal `undefined` when callers build the object directly in-process
    // rather than round-tripping it through JSON (which drops `undefined`
    // keys for free) -- the MCP server's direct DynamoDB backend does this
    // (`mcp/src/directBackend.ts`). Marshalling would otherwise reject the
    // whole item.
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

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
    await this.docClient.send(new PutCommand({ TableName: this.tableName, Item: deck }));
    return deck;
  }

  async getDeck(id: string, ownerId: string): Promise<Deck | undefined> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    const deck = result.Item as Deck | undefined;
    return deck && deck.ownerId === ownerId ? deck : undefined;
  }

  async listDecks(ownerId: string): Promise<Deck[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.ownerIndexName,
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: { ":ownerId": ownerId },
        ScanIndexForward: false, // newest updatedAt first (the index's sort key)
      }),
    );
    return (result.Items ?? []) as Deck[];
  }

  async updateDeck(id: string, ownerId: string, patch: UpdateDeck): Promise<Deck> {
    const names: Record<string, string> = { "#updatedAt": "updatedAt", "#version": "version" };
    const values: Record<string, unknown> = {
      ":ownerId": ownerId,
      ":expectedVersion": patch.expectedVersion,
      ":now": new Date().toISOString(),
      ":one": 1,
    };
    const sets = ["#updatedAt = :now", "#version = #version + :one"];

    for (const [field, value] of Object.entries({
      title: patch.title,
      themeId: patch.themeId,
      language: patch.language,
      slides: patch.slides,
    })) {
      if (value === undefined) continue;
      names[`#${field}`] = field;
      values[`:${field}`] = value;
      sets.push(`#${field} = :${field}`);
    }

    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression: `SET ${sets.join(", ")}`,
          ConditionExpression: "ownerId = :ownerId AND #version = :expectedVersion",
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      return result.Attributes as Deck;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        const current = await this.getDeck(id, ownerId);
        if (!current) throw new DeckNotFoundError();
        throw new DeckVersionConflictError(current.version);
      }
      throw err;
    }
  }

  async deleteDeck(id: string, ownerId: string): Promise<boolean> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { id },
          ConditionExpression: "ownerId = :ownerId",
          ExpressionAttributeValues: { ":ownerId": ownerId },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }
}
