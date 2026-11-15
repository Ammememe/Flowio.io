import type { Deck, NewDeck } from "@flowio/shared";
import { safeParseDeck } from "@flowio/shared";
import type { DeckBackend, UpdateDeckInput } from "./backend.js";
import { API_URL, DEV_EMAIL } from "./env.js";
import { ApiError, VersionConflictError } from "./errors.js";

/**
 * `DeckBackend` for local testing (`stdio.ts`): a thin HTTP client mirroring
 * `web/src/api/client.ts` -- the MCP server is just another caller of the
 * same local dev API endpoints the web app uses, authenticated the same
 * pre-OAuth way (see `env.ts`).
 */

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
    authorization: `Bearer dev:${DEV_EMAIL}`,
  };
  if (init.body !== undefined && !headers["content-type"]) headers["content-type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;

  const payload: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const error = payload as { error?: string; issues?: unknown } | undefined;
    if (res.status === 409) {
      const currentVersion = (error?.issues as { currentVersion?: number } | undefined)?.currentVersion ?? 0;
      throw new VersionConflictError(currentVersion);
    }
    throw new ApiError(res.status, error?.error ?? `Request failed: ${res.status}`, error?.issues);
  }

  return payload as T;
}

function parseOrThrow(raw: unknown): Deck {
  const parsed = safeParseDeck(raw);
  if (!parsed.success) throw new Error("Deck from API did not match the schema");
  return parsed.data;
}

export const httpBackend: DeckBackend = {
  listDecks: () => request("/decks"),

  async getDeck(id: string): Promise<Deck> {
    return parseOrThrow(await request<unknown>(`/decks/${id}`));
  },

  async createDeck(input: NewDeck): Promise<Deck> {
    return parseOrThrow(await request<unknown>("/decks", { method: "POST", body: JSON.stringify(input) }));
  },

  async updateDeck(id: string, patch: UpdateDeckInput): Promise<Deck> {
    return parseOrThrow(await request<unknown>(`/decks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }));
  },
};
