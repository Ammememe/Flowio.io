import type { LayoutId, Slide } from "@flowio/shared";
import { renderBullets } from "./bullets.js";
import { renderBulletsImage } from "./bulletsImage.js";
import { renderFullImage } from "./fullImage.js";
import { renderQuote } from "./quote.js";
import { renderSectionBreak } from "./sectionBreak.js";
import { renderTitle } from "./title.js";

/** P2-2: the six layout templates, keyed by the schema's `LayoutId`. */
export const layoutRenderers: Record<LayoutId, (slide: Slide) => HTMLElement> = {
  title: renderTitle,
  bullets: renderBullets,
  "bullets-image": renderBulletsImage,
  "full-image": renderFullImage,
  quote: renderQuote,
  "section-break": renderSectionBreak,
};
