/**
 * Theme id/name pairs only (P5-3's `list_themes` tool). The full visual
 * token sets (colour, type, spacing, motion) are a `web`-only concern --
 * see `web/src/themes/tokens.ts`, which defines `theme-a`/`theme-b` with
 * these same ids. Kept here, minimal, so a non-browser caller (the MCP
 * server) can list valid `themeId` values without depending on `web`.
 */
export interface ThemeSummary {
  id: string;
  name: string;
}

export const themeSummaries: ThemeSummary[] = [
  { id: "theme-a", name: "Static" },
  { id: "theme-b", name: "Animated" },
];
