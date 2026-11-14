import type { Slide } from "@flowio/shared";
import { el } from "../render/dom.js";

export interface SlideListHandlers {
  onSelect(index: number): void;
  onAdd(): void;
  onDuplicate(index: number): void;
  onDelete(index: number): void;
  onReorder(fromIndex: number, toIndex: number): void;
}

/** P3-4: sidebar slide list with add, duplicate, delete and drag-to-reorder. */
export function renderSlideList(
  slides: Slide[],
  currentIndex: number,
  listContainer: HTMLElement,
  addButtonContainer: HTMLElement,
  handlers: SlideListHandlers,
): void {
  listContainer.innerHTML = "";

  slides.forEach((slide, index) => {
    const item = el("li", {
      class: `slide-list__item${index === currentIndex ? " slide-list__item--active" : ""}`,
      attrs: { draggable: "true" },
    });

    const label = el("button", { class: "slide-list__label", attrs: { type: "button" } }, [
      `${index + 1}. ${summarize(slide)}`,
    ]);
    label.addEventListener("click", () => handlers.onSelect(index));

    const duplicateButton = el("button", { class: "icon", attrs: { type: "button", title: "Duplicate" } }, ["⧉"]);
    duplicateButton.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onDuplicate(index);
    });

    const deleteButton = el("button", { class: "icon", attrs: { type: "button", title: "Delete" } }, ["✕"]);
    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (slides.length <= 1) return; // keep at least one slide
      handlers.onDelete(index);
    });

    const actions = el("div", { class: "slide-list__actions" }, [duplicateButton, deleteButton]);
    item.append(label, actions);

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", String(index));
    });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer?.getData("text/plain"));
      if (!Number.isNaN(from)) handlers.onReorder(from, index);
    });

    listContainer.append(item);
  });

  addButtonContainer.innerHTML = "";
  const addButton = el("button", { class: "secondary", attrs: { type: "button" } }, ["+ Add slide"]);
  addButton.addEventListener("click", () => handlers.onAdd());
  addButtonContainer.append(addButton);
}

function summarize(slide: Slide): string {
  const text = slide.elements.find((e) => e.type === "title" || e.type === "bullet")?.text;
  if (text) return text.length > 28 ? `${text.slice(0, 28)}...` : text;
  return slide.layout;
}
