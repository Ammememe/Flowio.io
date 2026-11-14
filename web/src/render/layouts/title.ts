import type { Slide } from "@flowio/shared";
import { el } from "../dom.js";

/** P2-2: title layout -- a headline and an optional subtitle, centered. */
export function renderTitle(slide: Slide): HTMLElement {
  const titles = slide.elements.filter((e) => e.type === "title");
  const [main, sub] = titles;

  const children: HTMLElement[] = [];
  if (main) {
    children.push(
      el("h1", { class: "title-main", attrs: { "data-element-id": main.id } }, [main.text]),
    );
  }
  if (sub) {
    children.push(
      el("p", { class: "title-sub", attrs: { "data-element-id": sub.id } }, [sub.text]),
    );
  }

  return el("div", { class: "slide-layout slide-layout--title" }, children);
}
