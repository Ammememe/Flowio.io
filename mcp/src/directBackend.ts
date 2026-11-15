import {
  createDeck as createDeckHandler,
  getDeck as getDeckHandler,
  listDecks as listDecksHandler,
  updateDeck as updateDeckHandler,
  DynamoDeckStore,
  type AuthContext,
  type HandlerResult,
} from "@flowio/api";
import type { Deck, DeckSummary, NewDeck } from "@flowio/shared";
import type { DeckBackend, UpdateDeckInput } from "./backend.js";
import { ApiError, VersionConflictError } from "./errors.js";

/**
 * `DeckBackend` for the deployed Lambda (`lambda.ts`): calls the API
 * package's own handler functions directly against DynamoDB, instead of
 * going over HTTP through API Gateway + the Cognito verifier.
 *
 * Why: the deployed `Flowio-Api-dev` Lambdas only accept real Cognito
 * tokens (no dev-auth escape hatch there, by design -- see
 * `api/src/auth/getVerifier.ts`), and P5-1 (real sign-in from Claude) is
 * being done last, deliberately. Calling the handlers in-process with a
 * fixed `AuthContext` sidesteps that gate without touching it, using the
 * exact same DynamoDB table and business logic the real API uses -- once
 * P5-1 lands, this only needs to stop hardcoding `auth` and instead derive
 * it from the caller's real identity; `tools.ts` doesn't change at all.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const store = new DynamoDeckStore(requireEnv("DECKS_TABLE_NAME"));
const auth: AuthContext = { userId: `dev:${requireEnv("FLOWIO_MCP_DEV_EMAIL")}` };

function unwrap<T>(result: HandlerResult<T>): T {
  if (result.ok) return result.body;
  if (result.status === 409) {
    const currentVersion = (result.issues as { currentVersion?: number } | undefined)?.currentVersion ?? 0;
    throw new VersionConflictError(currentVersion);
  }
  throw new ApiError(result.status, result.error, result.issues);
}

export const directBackend: DeckBackend = {
  async listDecks(): Promise<DeckSummary[]> {
    return unwrap(await listDecksHandler(store, auth));
  },
  async getDeck(id: string): Promise<Deck> {
    return unwrap(await getDeckHandler(store, auth, id));
  },
  async createDeck(input: NewDeck): Promise<Deck> {
    return unwrap(await createDeckHandler(store, auth, input));
  },
  async updateDeck(id: string, patch: UpdateDeckInput): Promise<Deck> {
    return unwrap(await updateDeckHandler(store, auth, id, patch));
  },
};
