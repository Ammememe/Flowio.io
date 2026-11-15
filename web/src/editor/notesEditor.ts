import type { Slide } from "@flowio/shared";
import { el } from "../render/dom.js";

export interface NotesEditorHandlers {
  onNotesChange(notes: string): void;
}

/** P6-1: speaker notes, shown only in presenter view (P6-2) -- never on the audience-facing slide. */
export function renderNotesEditor(slide: Slide, container: HTMLElement, handlers: NotesEditorHandlers): void {
  container.innerHTML = "";

  const textarea = el("textarea", {
    class: "notes-editor__textarea",
    attrs: { placeholder: "What you'll say for this slide -- shown in presenter view, never to the audience." },
  });
  textarea.value = slide.notes ?? "";
  textarea.addEventListener("input", () => handlers.onNotesChange(textarea.value));

  container.append(textarea);
}
