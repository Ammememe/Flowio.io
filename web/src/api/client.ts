import {
  safeParseDeck,
  type Deck,
  type DeckSummary,
  type LayoutId,
  type NewDeck,
  type Slide,
} from "@flowio/shared";
import { getAuthHeader } from "../auth/devAuth.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
  }
}

/** Thrown by `updateDeck` specifically, so the editor can offer "reload and reapply" (P3-8). */
export class VersionConflictError extends ApiError {
  constructor(public readonly currentVersion: number) {
    super(409, "Deck was changed elsewhere since you last loaded it");
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeader = getAuthHeader();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (authHeader) headers.authorization = authHeader;
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

export function listDecks(): Promise<DeckSummary[]> {
  return request<DeckSummary[]>("/decks");
}

export async function getDeck(id: string): Promise<Deck> {
  const raw = await request<unknown>(`/decks/${id}`);
  const parsed = safeParseDeck(raw);
  if (!parsed.success) throw new Error("Deck from API did not match the schema");
  return parsed.data;
}

export async function createDeck(input: NewDeck): Promise<Deck> {
  const raw = await request<unknown>("/decks", { method: "POST", body: JSON.stringify(input) });
  const parsed = safeParseDeck(raw);
  if (!parsed.success) throw new Error("Deck from API did not match the schema");
  return parsed.data;
}

export interface UpdateDeckInput {
  title?: string;
  themeId?: string;
  language?: "sv" | "en";
  slides?: Slide[];
  expectedVersion: number;
}

export async function updateDeck(id: string, patch: UpdateDeckInput): Promise<Deck> {
  const raw = await request<unknown>(`/decks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  const parsed = safeParseDeck(raw);
  if (!parsed.success) throw new Error("Deck from API did not match the schema");
  return parsed.data;
}

export function deleteDeck(id: string): Promise<void> {
  return request<void>(`/decks/${id}`, { method: "DELETE" });
}

export function defaultLayoutId(): LayoutId {
  return "bullets";
}

/**
 * P4-1: a short-lived, single-use ElevenLabs Scribe token. Throws (502, or
 * 501 if ElevenLabs isn't configured server-side) if it can't get one --
 * callers (`speech/elevenLabsSource.ts`) treat that as "fall back to the
 * Web Speech API" rather than a fatal error.
 */
export async function getTranscriptionToken(): Promise<string> {
  const { token } = await request<{ token: string }>("/transcription-token", { method: "POST" });
  return token;
}
