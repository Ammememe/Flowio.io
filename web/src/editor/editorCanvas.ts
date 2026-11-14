import type { Slide } from "@flowio/shared";
import { el } from "../render/dom.js";
import { layoutRenderers } from "../render/layouts/index.js";
import { fitStageToContainer, STAGE_HEIGHT, STAGE_WIDTH } from "../render/scale.js";
import { applyTheme } from "../themes/applyTheme.js";
import type { ThemeTokens } from "../themes/tokens.js";
import { mountInlineEditor } from "./inlineEditor.js";

export interface EditorCanvasHandlers {
  onElementTextChange(elementId: string, text: string): void;
  onImageFileSelected(elementId: string, file: File): void;
}

export interface EditorCanvasHandle {
  destroy(): void;
}

/**
 * P3-4/P3-5/P3-6/P3-7: the editor canvas. Reuses the Phase 2 layout
 * templates and theme tokens so what you edit looks exactly like what
 * present mode will show, then hydrates each text element with an inline
 * Tiptap editor (P3-5) and each image element with a click-to-replace
 * overlay (P3-7) -- the live preview *is* the editor, there's no separate form.
 */
export function renderEditorCanvas(
  slide: Slide,
  theme: ThemeTokens,
  container: HTMLElement,
  handlers: EditorCanvasHandlers,
): EditorCanvasHandle {
  container.innerHTML = "";

  const stage = el("div", {
    class: "stage",
    attrs: { style: `width:${STAGE_WIDTH}px;height:${STAGE_HEIGHT}px;` },
  });
  applyTheme(stage, theme);

  const content = layoutRenderers[slide.layout](slide);
  stage.append(content);
  container.append(stage);
  const stopFitting = fitStageToContainer(stage, container);

  const cleanups: (() => void)[] = [];

  for (const element of slide.elements) {
    const node = content.querySelector<HTMLElement>(`[data-element-id="${cssEscape(element.id)}"]`);
    if (!node) continue;

    if (element.type === "title" || element.type === "bullet") {
      const inline = mountInlineEditor(node, element.text, (text) =>
        handlers.onElementTextChange(element.id, text),
      );
      cleanups.push(inline.destroy);
    } else if (element.type === "image") {
      const wrapper = node.parentElement;
      if (!wrapper) continue;
      wrapper.style.position = "relative";

      const fileInput = el("input", {
        attrs: { type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml" },
      }) as HTMLInputElement;
      fileInput.style.display = "none";
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) handlers.onImageFileSelected(element.id, file);
      });

      const overlay = el(
        "button",
        { class: "image-overlay", attrs: { type: "button" } },
        ["Replace image"],
      );
      overlay.addEventListener("click", () => fileInput.click());

      wrapper.append(fileInput, overlay);
      cleanups.push(() => {
        fileInput.remove();
        overlay.remove();
      });
    }
  }

  return {
    destroy() {
      for (const cleanup of cleanups) cleanup();
      stopFitting();
      stage.remove();
    },
  };
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
