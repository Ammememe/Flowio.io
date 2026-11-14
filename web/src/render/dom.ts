/** Tiny DOM builder, just enough to keep layout templates readable without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { class?: string; attrs?: Record<string, string>; text?: string } = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  }
  if (options.text !== undefined) node.textContent = options.text;
  for (const child of children) {
    node.append(child instanceof HTMLElement ? child : document.createTextNode(child));
  }
  return node;
}
