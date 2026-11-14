import type { Slide } from "@flowio/shared";
import { el } from "../dom.js";

/** P2-2: bullets-image layout -- heading + bullets on one side, one image on the other. */
export function renderBulletsImage(slide: Slide): HTMLElement {
  const heading = slide.elements.find((e) => e.type === "title");
  const bullets = slide.elements.filter((e) => e.type === "bullet");
  const image = slide.elements.find((e) => e.type === "image");

  const textChildren: HTMLElement[] = [];
  if (heading) {
    textChildren.push(el("h2", { class: "slide-heading", attrs: { "data-element-id": heading.id } }, [heading.text]));
  }
  textChildren.push(
    el(
      "ul",
      { class: "bullet-list" },
      bullets.map((b) => el("li", { class: "bullet", attrs: { "data-element-id": b.id } }, [b.text])),
    ),
  );

  const children = [el("div", { class: "bullets-image__text" }, textChildren)];
  if (image) {
    children.push(
      el("div", { class: "bullets-image__media" }, [
        el("img", {
          attrs: { src: image.src, alt: image.alt, "data-element-id": image.id },
        }),
      ]),
    );
  }

  return el("div", { class: "slide-layout slide-layout--bullets-image" }, children);
}
