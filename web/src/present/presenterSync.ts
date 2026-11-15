/**
 * P6-2: the wire format `present.html` (the audience window) and
 * `presenter.html` (a separate companion window, same browser) exchange
 * over a `BroadcastChannel` to stay in sync -- same-origin, cross-tab/
 * cross-window, no server involved.
 */
export type PresenterSyncMessage =
  /** Sent by the audience window whenever its slide changes, for any reason (keyboard, clicker, or a `goTo` below). */
  | { type: "slideChanged"; index: number }
  /** Sent by the presenter window to command the audience window to navigate. */
  | { type: "goTo"; index: number };

/** One channel per deck, so presenting two different decks in the same browser never cross-talks. */
export function presenterSyncChannelName(deckId: string | null): string {
  return `flowio-presenter-sync:${deckId ?? "sample"}`;
}
