import { layoutIds, type LayoutId } from "@flowio/shared";
import { el } from "../render/dom.js";
import { themesById } from "../themes/tokens.js";

export interface PickerHandlers {
  onLayoutChange(layoutId: LayoutId): void;
  onThemeChange(themeId: string): void;
}

const layoutLabels: Record<LayoutId, string> = {
  title: "Title",
  bullets: "Bullets",
  "bullets-image": "Bullets + image",
  "full-image": "Full image",
  quote: "Quote",
  "section-break": "Section break",
};

/** P3-6: layout picker (per slide) and theme picker (per deck). */
export function renderPickers(
  container: HTMLElement,
  currentLayout: LayoutId,
  currentThemeId: string,
  handlers: PickerHandlers,
): void {
  container.innerHTML = "";

  const layoutSelect = el("select", { attrs: { id: "layout-picker" } }) as HTMLSelectElement;
  for (const id of layoutIds) {
    const option = el("option", { attrs: { value: id } }, [layoutLabels[id]]) as HTMLOptionElement;
    layoutSelect.append(option);
  }
  layoutSelect.value = currentLayout;
  layoutSelect.addEventListener("change", () => handlers.onLayoutChange(layoutSelect.value as LayoutId));

  const themeSelect = el("select", { attrs: { id: "theme-picker" } }) as HTMLSelectElement;
  for (const theme of Object.values(themesById)) {
    const option = el("option", { attrs: { value: theme.id } }, [theme.name]) as HTMLOptionElement;
    themeSelect.append(option);
  }
  themeSelect.value = currentThemeId;
  themeSelect.addEventListener("change", () => handlers.onThemeChange(themeSelect.value));

  container.append(
    el("label", { class: "picker", attrs: { for: "layout-picker" } }, ["Layout", layoutSelect]),
    el("label", { class: "picker", attrs: { for: "theme-picker" } }, ["Theme", themeSelect]),
  );
}
