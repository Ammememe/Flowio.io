import type { Deck } from "@flowio/shared";
import { updateDeck, VersionConflictError, type UpdateDeckInput } from "../api/client.js";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export interface AutosaveHandlers {
  onStatusChange(status: SaveStatus, message?: string): void;
  /** The server's copy after a successful save -- update local `version`/`updatedAt` from this. */
  onSaved(deck: Deck): void;
}

/**
 * P3-8: autosave with a version number. Edits are debounced into one
 * PATCH; if the server rejects it with 409 (another tab/device saved
 * first), `onStatusChange("conflict")` fires instead of silently
 * overwriting -- the caller decides how to resolve it (here: prompt to reload).
 */
export function createAutosave(deckId: string, handlers: AutosaveHandlers, debounceMs = 800) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: UpdateDeckInput | undefined;
  let saving = false;

  async function flush(): Promise<void> {
    if (saving || !pending) return;
    const patch = pending;
    pending = undefined;
    saving = true;
    handlers.onStatusChange("saving");
    try {
      const deck = await updateDeck(deckId, patch);
      handlers.onStatusChange("saved");
      handlers.onSaved(deck);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        handlers.onStatusChange("conflict");
      } else {
        handlers.onStatusChange("error", err instanceof Error ? err.message : String(err));
      }
    } finally {
      saving = false;
      if (pending) void flush(); // an edit arrived while this save was in flight
    }
  }

  function schedule(patch: UpdateDeckInput): void {
    pending = { ...pending, ...patch, expectedVersion: patch.expectedVersion };
    handlers.onStatusChange("idle");
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), debounceMs);
  }

  function flushNow(): Promise<void> {
    clearTimeout(timer);
    return flush();
  }

  return { schedule, flushNow };
}
