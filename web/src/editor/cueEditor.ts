import type { Slide } from "@flowio/shared";
import { el } from "../render/dom.js";

export interface CueEditorHandlers {
  onCuesChange(elementId: string, cues: string[]): void;
}

/**
 * P3-9: optional "what I will say" phrases per bullet. One row per
 * title/bullet element on the current slide -- cues are what Phase 4's
 * matcher (and Claude, in Phase 5) score spoken text against, in addition
 * to the element's own text.
 */
export function renderCueEditor(slide: Slide, container: HTMLElement, handlers: CueEditorHandlers): void {
  container.innerHTML = "";

  const textElements = slide.elements.filter((e) => e.type === "title" || e.type === "bullet");
  if (textElements.length === 0) {
    container.append(el("p", { class: "cue-editor__empty" }, ["This slide has no text elements to add cues to."]));
    return;
  }

  for (const element of textElements) {
    const row = el("div", { class: "cue-editor__row" });
    const label = el("div", { class: "cue-editor__label" }, [truncate(element.text, 44)]);
    const chips = el("div", { class: "cue-editor__chips" });

    for (const cue of element.cues) {
      const removeButton = el("button", { class: "cue-chip__remove", attrs: { type: "button", title: "Remove cue" } }, [
        "×",
      ]);
      const chip = el("span", { class: "cue-chip" }, [cue, removeButton]);
      removeButton.addEventListener("click", () => {
        handlers.onCuesChange(
          element.id,
          element.cues.filter((c) => c !== cue),
        );
      });
      chips.append(chip);
    }

    const input = el("input", {
      class: "cue-editor__input",
      attrs: { type: "text", placeholder: "Add a cue phrase, press Enter" },
    }) as HTMLInputElement;
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const value = input.value.trim();
      if (!value || element.cues.includes(value)) return;
      handlers.onCuesChange(element.id, [...element.cues, value]);
      input.value = "";
    });

    row.append(label, chips, input);
    container.append(row);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
