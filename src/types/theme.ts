export interface ThemeColors {
  /** Main brand/button color (e.g. "#175ddc") */
  accentPrimary: string;
  /** Hover & active accent color (e.g. "#3b82f6") */
  accentHover: string;
  /** Highlight & icon accent color (e.g. "#60a5fa") */
  accentLight: string;
  /** Deepest window background (e.g. "#020617") */
  appBackground: string;
  /** Sidebar, modals & secondary panels (e.g. "#0f172a") */
  panelBackground: string;
  /** Cards, inputs & hover surfaces (e.g. "#1e293b") */
  cardBackground: string;
  /** Borders & dividers (e.g. "#334155") */
  border: string;
  /** Main headings & body text (e.g. "#f1f5f9") */
  textPrimary: string;
  /** Secondary labels & subtitles (e.g. "#94a3b8") */
  textSecondary: string;
  /** Muted hints, placeholders & counters (e.g. "#64748b") */
  textMuted: string;
}

export interface ThemeSizing {
  /** Root HTML font size in pixels (default: 16, range: 13–20) */
  baseFontSizePx: number;
  /** Base card/control border radius in pixels (default: 12, range: 4–20) */
  borderRadiusPx: number;
  /** Left navigation sidebar width in pixels (default: 240, range: 200–340) */
  sidebarWidthPx: number;
  /** Middle cipher list width in pixels (default: 320, range: 260–440) */
  listWidthPx: number;
}

export interface FerriVaultTheme {
  id: string;
  name: string;
  author?: string;
  isBuiltIn?: boolean;
  colorScheme: "dark" | "light";
  colors: ThemeColors;
  sizing: ThemeSizing;
}
