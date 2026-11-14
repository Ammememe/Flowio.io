import type { Slide } from "@flowio/shared";
import { el } from "../dom.js";

/** P2-2: section-break layout -- one big centered title, used as a divider. */
export function renderSectionBreak(slide: Slide): HTMLElement {
  const heading = slide.elements.find((e) => e.type === "title");
  const children: HTMLElement[] = [];
  if (heading) {
    children.push(
      el("h1", { class: "section-break__title", attrs: { "data-element-id": heading.id } }, [heading.text]),
    );
  }
  return el("div", { class: "slide-layout slide-layout--section-break" }, children);
}
