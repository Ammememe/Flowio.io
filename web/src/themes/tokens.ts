/**
 * Theme system (P2-3): tokens for colour, type, spacing and motion level.
 * A theme is pure data -- the renderer turns it into CSS custom properties
 * (see `applyTheme` in `render/renderSlide.ts`) so layouts never hardcode a
 * colour or a font size themselves.
 */

export interface ThemeTokens {
  id: string;
  name: string;
  color: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    /** Colour of a bullet that is dimmed because another one is emphasised. */
    dim: string;
  };
  type: {
    fontFamily: string;
    titleWeight: string;
    /** rem */
    scaleTitle: number;
    scaleBody: number;
    scaleSmall: number;
    lineHeight: number;
  };
  spacing: {
    /** px, the base unit the rest of spacing multiplies. */
    unit: number;
    slidePadding: number;
    bulletGap: number;
  };
  /**
   * 0 = static (Theme A): only simple CSS fades, no Motion involvement.
   * 1 = animated (Theme B): entrance/emphasis/exit/transition all go
   * through Motion (P2-5).
   */
  motionLevel: 0 | 1;
}

export const themeA: ThemeTokens = {
  id: "theme-a",
  name: "Static",
  color: {
    background: "#ffffff",
    foreground: "#1a1f24",
    accent: "#1a1f24",
    muted: "#6b7684",
    dim: "#c3cad1",
  },
  type: {
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
    titleWeight: "700",
    scaleTitle: 3.4,
    scaleBody: 1.6,
    scaleSmall: 1.1,
    lineHeight: 1.35,
  },
  spacing: {
    unit: 8,
    slidePadding: 72,
    bulletGap: 28,
  },
  motionLevel: 0,
};

export const themeB: ThemeTokens = {
  id: "theme-b",
  name: "Animated",
  color: {
    background: "#0e1116",
    foreground: "#f3f6fa",
    accent: "#5ec4ff",
    muted: "#8b98a8",
    dim: "#3a4452",
  },
  type: {
    fontFamily:
      '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    titleWeight: "650",
    scaleTitle: 3.2,
    scaleBody: 1.55,
    scaleSmall: 1.05,
    lineHeight: 1.3,
  },
  spacing: {
    unit: 8,
    slidePadding: 72,
    bulletGap: 26,
  },
  motionLevel: 1,
};

export const themesById: Record<string, ThemeTokens> = {
  [themeA.id]: themeA,
  [themeB.id]: themeB,
};
