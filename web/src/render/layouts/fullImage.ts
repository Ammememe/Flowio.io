import type { Slide } from "@flowio/shared";
import { el } from "../dom.js";

/** P2-2: full-image layout -- a single image filling the slide. */
export function renderFullImage(slide: Slide): HTMLElement {
  const image = slide.elements.find((e) => e.type === "image");
  const children: HTMLElement[] = [];
  if (image) {
    children.push(
      el("img", {
        class: "full-image__img",
        attrs: { src: image.src, alt: image.alt, "data-element-id": image.id },
      }),
    );
  }
  return el("div", { class: "slide-layout slide-layout--full-image" }, children);
}
