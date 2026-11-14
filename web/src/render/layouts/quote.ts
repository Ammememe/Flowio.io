import type { Slide } from "@flowio/shared";
import { el } from "../dom.js";

/**
 * P2-2: quote layout -- a large quote. The schema has no dedicated "quote"
 * element type, so by convention the first `title` element holds the quote
 * text and an optional following `bullet` element holds the attribution.
 */
export function renderQuote(slide: Slide): HTMLElement {
  const quote = slide.elements.find((e) => e.type === "title");
  const attribution = slide.elements.find((e) => e.type === "bullet");

  const children: HTMLElement[] = [];
  if (quote) {
    children.push(
      el("blockquote", { class: "quote-text", attrs: { "data-element-id": quote.id } }, [quote.text]),
    );
  }
  if (attribution) {
    children.push(
      el("p", { class: "quote-attribution", attrs: { "data-element-id": attribution.id } }, [
        `— ${attribution.text}`,
      ]),
    );
  }

  return el("div", { class: "slide-layout slide-layout--quote" }, children);
}
