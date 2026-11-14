import type { ThemeTokens } from "./tokens.js";

/** Turns a theme's tokens into CSS custom properties on `root` (see `web/src/style.css`). */
export function applyTheme(root: HTMLElement, theme: ThemeTokens): void {
  root.dataset.theme = theme.motionLevel === 0 ? "static" : "animated";
  const vars: Record<string, string> = {
    "--color-bg": theme.color.background,
    "--color-fg": theme.color.foreground,
    "--color-accent": theme.color.accent,
    "--color-muted": theme.color.muted,
    "--color-dim": theme.color.dim,
    "--font-family": theme.type.fontFamily,
    "--title-weight": theme.type.titleWeight,
    "--scale-title": `${theme.type.scaleTitle}rem`,
    "--scale-body": `${theme.type.scaleBody}rem`,
    "--scale-small": `${theme.type.scaleSmall}rem`,
    "--line-height": String(theme.type.lineHeight),
    "--spacing-unit": `${theme.spacing.unit}px`,
    "--slide-padding": `${theme.spacing.slidePadding}px`,
    "--bullet-gap": `${theme.spacing.bulletGap}px`,
  };
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
}
