import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";

/** A document that holds exactly one line of plain text -- no paragraphs, no marks. */
const SingleLineDocument = Document.extend({ content: "text*" });

/**
 * P3-5: in-place text editing with Tiptap. Bullet/title text in the schema
 * is a flat string, so each field gets a minimal single-line Tiptap editor
 * mounted directly onto the element the renderer already produced (the
 * `h1`/`li`/`blockquote` with `data-element-id`) -- the live preview *is*
 * the edit surface, nothing is duplicated into a separate form.
 */
export function mountInlineEditor(
  element: HTMLElement,
  initialText: string,
  onChange: (text: string) => void,
): { destroy(): void; setText(text: string): void } {
  // Tiptap appends its own contenteditable node into `element` rather than
  // replacing what's there -- clear the static text the renderer put here
  // first, or the original text and Tiptap's copy both show up.
  element.textContent = "";

  const editor = new Editor({
    element,
    extensions: [SingleLineDocument, Text],
    content: initialText,
    editorProps: {
      attributes: { class: "inline-editable" },
      handleKeyDown(_view, event) {
        // No paragraph node to split into -- keep Enter from doing anything surprising.
        if (event.key === "Enter") {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: e }) {
      onChange(e.getText());
    },
  });

  return {
    destroy: () => editor.destroy(),
    setText: (text: string) => {
      if (editor.getText() === text) return;
      editor.commands.setContent(text);
    },
  };
}
