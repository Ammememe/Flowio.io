import { WEB_URL } from "./env.js";

/** P5-7: every write tool returns this so Claude can hand the user a link. */
export function deckEditorUrl(deckId: string): string {
  return `${WEB_URL}/editor.html?deckId=${deckId}`;
}
