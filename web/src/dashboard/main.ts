import { DECK_SCHEMA_VERSION, type NewDeck } from "@flowio/shared";
import { requireSignIn, signOut } from "../auth/devAuth.js";
import { createDeck, deleteDeck, listDecks, updateDeck } from "../api/client.js";

const user = requireSignIn();

document.querySelector<HTMLSpanElement>("#user-email")!.textContent = user.email;
document.querySelector<HTMLButtonElement>("#sign-out")!.addEventListener("click", () => {
  signOut();
  location.href = "/signin.html";
});

const listEl = document.querySelector<HTMLUListElement>("#deck-list")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const newDeckButton = document.querySelector<HTMLButtonElement>("#new-deck")!;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

async function refresh(): Promise<void> {
  statusEl.textContent = "Loading...";
  try {
    const decks = await listDecks();
    listEl.innerHTML = "";
    if (decks.length === 0) {
      statusEl.textContent = "No decks yet -- create one to get started.";
      return;
    }
    statusEl.textContent = "";
    for (const deck of decks) {
      const li = document.createElement("li");
      li.className = "deck-card";

      const titleButton = document.createElement("button");
      titleButton.className = "deck-card__title";
      titleButton.textContent = deck.title;
      titleButton.addEventListener("click", () => {
        location.href = `/editor.html?deckId=${deck.id}`;
      });

      const meta = document.createElement("div");
      meta.className = "deck-card__meta";
      meta.textContent = `Updated ${formatDate(deck.updatedAt)}`;

      const actions = document.createElement("div");
      actions.className = "deck-card__actions";

      const renameButton = document.createElement("button");
      renameButton.className = "secondary";
      renameButton.textContent = "Rename";
      renameButton.addEventListener("click", async () => {
        const nextTitle = prompt("Rename deck", deck.title);
        if (!nextTitle || nextTitle === deck.title) return;
        try {
          await updateDeck(deck.id, { title: nextTitle, expectedVersion: deck.version });
          await refresh();
        } catch (err) {
          statusEl.textContent = err instanceof Error ? err.message : String(err);
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "danger";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Delete "${deck.title}"? This cannot be undone.`)) return;
        try {
          await deleteDeck(deck.id);
          await refresh();
        } catch (err) {
          statusEl.textContent = err instanceof Error ? err.message : String(err);
        }
      });

      actions.append(renameButton, deleteButton);
      li.append(titleButton, meta, actions);
      listEl.append(li);
    }
  } catch (err) {
    statusEl.textContent = `Could not load decks: ${err instanceof Error ? err.message : String(err)}`;
  }
}

newDeckButton.addEventListener("click", async () => {
  const title = prompt("Deck title", "Untitled deck");
  if (!title) return;

  const newDeck: NewDeck = {
    schemaVersion: DECK_SCHEMA_VERSION,
    title,
    themeId: "theme-a",
    language: "en",
    slides: [
      {
        id: crypto.randomUUID(),
        layout: "title",
        elements: [{ id: crypto.randomUUID(), type: "title", text: title, cues: [] }],
      },
    ],
  };

  try {
    const deck = await createDeck(newDeck);
    location.href = `/editor.html?deckId=${deck.id}`;
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : String(err);
  }
});

void refresh();
