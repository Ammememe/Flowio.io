import type { Deck, LayoutId, Slide } from "@flowio/shared";
import { requireSignIn } from "../auth/devAuth.js";
import { getDeck } from "../api/client.js";
import { uploadImage } from "../api/upload.js";
import { themesById } from "../themes/tokens.js";
import { createAutosave, type SaveStatus } from "./autosave.js";
import { renderCueEditor } from "./cueEditor.js";
import { renderEditorCanvas, type EditorCanvasHandle } from "./editorCanvas.js";
import { History } from "./history.js";
import { renderNotesEditor } from "./notesEditor.js";
import { renderPickers } from "./pickers.js";
import { renderSlideList } from "./slideList.js";
import "./style.css";

requireSignIn();

const deckId = new URLSearchParams(location.search).get("deckId");
if (!deckId) {
  location.href = "/dashboard.html";
  throw new Error("No ?deckId= -- redirecting");
}

// ---- DOM handles -----------------------------------------------------
const titleInput = document.querySelector<HTMLInputElement>("#deck-title")!;
const pickersEl = document.querySelector<HTMLDivElement>("#pickers")!;
const slideListEl = document.querySelector<HTMLUListElement>("#slide-list")!;
const addSlideEl = document.querySelector<HTMLDivElement>("#add-slide")!;
const canvasEl = document.querySelector<HTMLDivElement>("#editor-canvas")!;
const cueEditorEl = document.querySelector<HTMLDivElement>("#cue-editor")!;
const notesEditorEl = document.querySelector<HTMLDivElement>("#notes-editor")!;
const statusEl = document.querySelector<HTMLSpanElement>("#save-status")!;
const undoButton = document.querySelector<HTMLButtonElement>("#undo")!;
const redoButton = document.querySelector<HTMLButtonElement>("#redo")!;
const presentLink = document.querySelector<HTMLAnchorElement>("#present-link")!;
const presenterLink = document.querySelector<HTMLAnchorElement>("#presenter-link")!;
const conflictBanner = document.querySelector<HTMLParagraphElement>("#conflict-banner")!;
const reloadButton = document.querySelector<HTMLButtonElement>("#reload-deck")!;

presentLink.href = `/present.html?deckId=${deckId}`;
presenterLink.href = `/presenter.html?deckId=${deckId}`;

// ---- State -------------------------------------------------------------
let deck: Deck;
let currentSlideIndex = 0;
let canvasHandle: EditorCanvasHandle | undefined;
const history = new History<Deck>();
let historyDebounce: ReturnType<typeof setTimeout> | undefined;

let hasUnsavedLocalEdits = false;

const autosave = createAutosave(deckId, {
  onStatusChange(status: SaveStatus, message?: string) {
    hasUnsavedLocalEdits = status !== "saved";
    statusEl.textContent = statusLabel(status, message);
    if (status === "conflict") conflictBanner.hidden = false;
  },
  onSaved(serverDeck: Deck) {
    deck.version = serverDeck.version;
    deck.updatedAt = serverDeck.updatedAt;
  },
});

function statusLabel(status: SaveStatus, message?: string): string {
  switch (status) {
    case "idle":
      return "Unsaved changes";
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "conflict":
      return "Save conflict";
    case "error":
      return `Save failed${message ? `: ${message}` : ""}`;
  }
}

function saveNow(): void {
  autosave.schedule({
    title: deck.title,
    themeId: deck.themeId,
    slides: deck.slides,
    expectedVersion: deck.version,
  });
}

function pushHistory(): void {
  history.push(deck);
  updateUndoRedoButtons();
}

function pushHistoryDebounced(): void {
  clearTimeout(historyDebounce);
  historyDebounce = setTimeout(pushHistory, 800);
}

function updateUndoRedoButtons(): void {
  undoButton.disabled = !history.canUndo();
  redoButton.disabled = !history.canRedo();
}

// ---- Rendering -----------------------------------------------------------
function renderCanvas(): void {
  canvasHandle?.destroy();
  const slide = deck.slides[currentSlideIndex];
  const theme = themesById[deck.themeId] ?? Object.values(themesById)[0];
  canvasHandle = renderEditorCanvas(slide, theme, canvasEl, {
    onElementTextChange(elementId, text) {
      const element = slide.elements.find((e) => e.id === elementId);
      if (!element || element.type === "image") return;
      element.text = text;
      renderSlideListUi(); // slide summary text may have changed
      saveNow();
      pushHistoryDebounced();
    },
    onImageFileSelected(elementId, file) {
      void (async () => {
        statusEl.textContent = "Uploading image...";
        try {
          const url = await uploadImage(file);
          const element = slide.elements.find((e) => e.id === elementId);
          if (element && element.type === "image") element.src = url;
          renderCanvas();
          saveNow();
          pushHistory();
        } catch (err) {
          statusEl.textContent = `Upload failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      })();
    },
  });
}

function renderPickersUi(): void {
  const slide = deck.slides[currentSlideIndex];
  renderPickers(pickersEl, slide.layout, deck.themeId, {
    onLayoutChange(layoutId: LayoutId) {
      slide.layout = layoutId;
      renderCanvas();
      renderSlideListUi();
      saveNow();
      pushHistory();
    },
    onThemeChange(themeId: string) {
      deck.themeId = themeId;
      renderCanvas();
      saveNow();
      pushHistory();
    },
  });
}

function renderSlideListUi(): void {
  renderSlideList(deck.slides, currentSlideIndex, slideListEl, addSlideEl, {
    onSelect(index) {
      currentSlideIndex = index;
      selectSlide();
    },
    onAdd() {
      const newSlide: Slide = {
        id: crypto.randomUUID(),
        layout: "bullets",
        elements: [{ id: crypto.randomUUID(), type: "title", text: "New slide", cues: [] }],
      };
      deck.slides.splice(currentSlideIndex + 1, 0, newSlide);
      currentSlideIndex += 1;
      selectSlide();
      saveNow();
      pushHistory();
    },
    onDuplicate(index) {
      const copy = structuredClone(deck.slides[index]);
      copy.id = crypto.randomUUID();
      for (const element of copy.elements) element.id = crypto.randomUUID();
      deck.slides.splice(index + 1, 0, copy);
      currentSlideIndex = index + 1;
      selectSlide();
      saveNow();
      pushHistory();
    },
    onDelete(index) {
      deck.slides.splice(index, 1);
      if (currentSlideIndex >= deck.slides.length) currentSlideIndex = deck.slides.length - 1;
      selectSlide();
      saveNow();
      pushHistory();
    },
    onReorder(from, to) {
      if (from === to) return;
      const movingCurrent = from === currentSlideIndex;
      const [moved] = deck.slides.splice(from, 1);
      deck.slides.splice(to, 0, moved);
      if (movingCurrent) currentSlideIndex = to;
      else if (from < currentSlideIndex && to >= currentSlideIndex) currentSlideIndex -= 1;
      else if (from > currentSlideIndex && to <= currentSlideIndex) currentSlideIndex += 1;
      selectSlide();
      saveNow();
      pushHistory();
    },
  });
}

function renderCueEditorUi(): void {
  const slide = deck.slides[currentSlideIndex];
  renderCueEditor(slide, cueEditorEl, {
    onCuesChange(elementId, cues) {
      const element = slide.elements.find((e) => e.id === elementId);
      if (!element) return;
      element.cues = cues;
      renderCueEditorUi();
      saveNow();
      pushHistory();
    },
  });
}

function renderNotesEditorUi(): void {
  const slide = deck.slides[currentSlideIndex];
  renderNotesEditor(slide, notesEditorEl, {
    onNotesChange(notes) {
      slide.notes = notes;
      saveNow();
      pushHistoryDebounced();
    },
  });
}

/** Full re-render after the current slide identity changed (select/add/duplicate/delete/reorder). */
function selectSlide(): void {
  renderSlideListUi();
  renderPickersUi();
  renderCanvas();
  renderCueEditorUi();
  renderNotesEditorUi();
}

// ---- Top bar wiring --------------------------------------------------
titleInput.addEventListener("input", () => {
  deck.title = titleInput.value;
  saveNow();
  pushHistoryDebounced();
});

undoButton.addEventListener("click", () => {
  const previous = history.undo();
  if (!previous) return;
  deck = previous;
  currentSlideIndex = Math.min(currentSlideIndex, deck.slides.length - 1);
  titleInput.value = deck.title;
  selectSlide();
  updateUndoRedoButtons();
  saveNow();
});

redoButton.addEventListener("click", () => {
  const next = history.redo();
  if (!next) return;
  deck = next;
  currentSlideIndex = Math.min(currentSlideIndex, deck.slides.length - 1);
  titleInput.value = deck.title;
  selectSlide();
  updateUndoRedoButtons();
  saveNow();
});

reloadButton.addEventListener("click", () => void load());

window.addEventListener("beforeunload", () => {
  void autosave.flushNow();
});

// ---- Load --------------------------------------------------------------
async function load(): Promise<void> {
  try {
    deck = await getDeck(deckId!);
  } catch (err) {
    canvasEl.textContent = `Could not load deck: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  conflictBanner.hidden = true;
  currentSlideIndex = 0;
  titleInput.value = deck.title;
  history.push(deck);
  updateUndoRedoButtons();
  selectSlide();
}

/**
 * P5-7: picks up changes made elsewhere (by Claude, through the MCP server,
 * or another tab) without the presenter having to hit reload themselves.
 * Only applies them while there's nothing unsaved locally, so a poll can
 * never clobber an in-progress edit -- that case still goes through the
 * existing version-conflict banner instead.
 */
async function pollForRemoteChanges(): Promise<void> {
  if (hasUnsavedLocalEdits) return;
  let fresh: Deck;
  try {
    fresh = await getDeck(deckId!);
  } catch {
    return; // transient network error -- try again on the next tick
  }
  if (fresh.version <= deck.version) return;
  deck = fresh;
  currentSlideIndex = Math.min(currentSlideIndex, deck.slides.length - 1);
  titleInput.value = deck.title;
  history.push(deck);
  updateUndoRedoButtons();
  selectSlide();
  statusEl.textContent = "Updated elsewhere";
}

void load();
setInterval(() => void pollForRemoteChanges(), 4000);
