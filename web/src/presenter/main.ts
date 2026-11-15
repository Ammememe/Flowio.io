import type { Deck } from "@flowio/shared";
import { getDeck } from "../api/client.js";
import { sampleDeck } from "../deck/sampleDeck.js";
import { presenterSyncChannelName, type PresenterSyncMessage } from "../present/presenterSync.js";
import { renderSlide } from "../render/renderSlide.js";
import type { RenderedSlide } from "../render/types.js";
import { themeA, themesById } from "../themes/tokens.js";
import "./style.css";

const currentEl = document.querySelector<HTMLDivElement>("#current-slide")!;
const nextEl = document.querySelector<HTMLDivElement>("#next-slide")!;
const notesEl = document.querySelector<HTMLParagraphElement>("#notes-text")!;
const timerEl = document.querySelector<HTMLSpanElement>("#timer")!;
const prevButton = document.querySelector<HTMLButtonElement>("#prev")!;
const nextButton = document.querySelector<HTMLButtonElement>("#next")!;

/**
 * P6-2: presenter view -- what the presenter looks at on their own screen
 * (speaker notes, what's coming next, an elapsed timer), kept in sync with
 * a separate audience window (`present.html`, the actual on-screen/
 * projected deck) via `BroadcastChannel` rather than any server round-trip.
 * Either window can drive navigation; the other just follows.
 */
function run(deck: Deck, deckId: string | null): void {
  const theme = themesById[deck.themeId] ?? themeA;
  const syncChannel = new BroadcastChannel(presenterSyncChannelName(deckId));

  let index = 0;
  let currentRendered: RenderedSlide | undefined;
  let nextRendered: RenderedSlide | undefined;

  function render(): void {
    currentRendered?.destroy();
    nextRendered?.destroy();
    currentRendered = renderSlide(deck.slides[index], theme, currentEl);
    const next = deck.slides[index + 1];
    nextRendered = next ? renderSlide(next, theme, nextEl) : undefined;
    notesEl.textContent = deck.slides[index].notes?.trim() || "(no notes for this slide)";
    prevButton.disabled = index === 0;
    nextButton.disabled = index === deck.slides.length - 1;
  }

  function goTo(nextIndex: number): void {
    const clamped = Math.min(Math.max(nextIndex, 0), deck.slides.length - 1);
    if (clamped === index) return;
    index = clamped;
    render();
    syncChannel.postMessage({ type: "goTo", index } satisfies PresenterSyncMessage);
  }

  syncChannel.onmessage = (event: MessageEvent<PresenterSyncMessage>) => {
    if (event.data.type !== "slideChanged") return;
    if (event.data.index === index) return;
    index = event.data.index;
    render();
  };

  prevButton.addEventListener("click", () => goTo(index - 1));
  nextButton.addEventListener("click", () => goTo(index + 1));
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "PageDown") goTo(index + 1);
    else if (event.key === "ArrowLeft" || event.key === "PageUp") goTo(index - 1);
  });

  render();

  const startedAt = Date.now();
  setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    timerEl.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

async function main(): Promise<void> {
  const deckId = new URLSearchParams(location.search).get("deckId");

  if (!deckId) {
    run(sampleDeck, null);
    return;
  }

  try {
    const deck = await getDeck(deckId);
    run(deck, deckId);
  } catch (err) {
    currentEl.textContent = `Could not load deck: ${err instanceof Error ? err.message : String(err)}`;
  }
}

void main();
