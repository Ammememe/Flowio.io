import type { Slide } from "@flowio/shared";
import { el } from "../dom.js";

/** P2-2: bullets layout -- a heading and a bulleted list, one `<li>` per bullet. */
export function renderBullets(slide: Slide): HTMLElement {
  const heading = slide.elements.find((e) => e.type === "title");
  const bullets = slide.elements.filter((e) => e.type === "bullet");

  const children: HTMLElement[] = [];
  if (heading) {
    children.push(el("h2", { class: "slide-heading", attrs: { "data-element-id": heading.id } }, [heading.text]));
  }
  children.push(
    el(
      "ul",
      { class: "bullet-list" },
      bullets.map((b) =>
        el("li", { class: "bullet", attrs: { "data-element-id": b.id } }, [b.text]),
      ),
    ),
  );

  return el("div", { class: "slide-layout slide-layout--bullets" }, children);
}
