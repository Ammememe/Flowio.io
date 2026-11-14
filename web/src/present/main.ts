import { getDeck } from "../api/client.js";
import { sampleDeck } from "../deck/sampleDeck.js";
import { startPresenting } from "./presentMode.js";
import "./style.css";

const container = document.querySelector<HTMLDivElement>("#present-container")!;
const hud = document.querySelector<HTMLDivElement>("#present-hud");

function setHud(text: string): void {
  if (hud) hud.textContent = text;
}

async function run(): Promise<void> {
  const deckId = new URLSearchParams(location.search).get("deckId");

  // No ?deckId= -> the Phase 2 demo deck (unauthenticated, no API call).
  if (!deckId) {
    startPresenting(sampleDeck, container);
    setHud("← → navigate · 1-9 emphasize · 0 clear · t theme · f fullscreen");
    return;
  }

  // P3-3/P3-4: present a real deck saved through the editor.
  try {
    const deck = await getDeck(deckId);
    startPresenting(deck, container);
    setHud("← → navigate · 1-9 emphasize · 0 clear · t theme · f fullscreen");
  } catch (err) {
    container.textContent = `Could not load deck: ${err instanceof Error ? err.message : String(err)}`;
  }
}

void run();
