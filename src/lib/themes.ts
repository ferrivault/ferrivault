import type { FerriVaultTheme, ThemeColors, ThemeSizing } from "../types/theme";

export const DEFAULT_THEME_SIZING: ThemeSizing = {
  baseFontSizePx: 16,
  borderRadiusPx: 12,
  sidebarWidthPx: 240,
  listWidthPx: 320,
};

export const BUILTIN_THEMES: FerriVaultTheme[] = [
  {
    id: "ferrivault-dark",
    name: "FerriVault Cobalt",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#175ddc",
      accentHover: "#3b82f6",
      accentLight: "#60a5fa",
      appBackground: "#020617",
      panelBackground: "#0f172a",
      cardBackground: "#1e293b",
      border: "#334155",
      textPrimary: "#f1f5f9",
      textSecondary: "#94a3b8",
      textMuted: "#64748b",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "ferri-iron",
    name: "Forged Iron",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#476685",
      accentHover: "#5b7fa3",
      accentLight: "#8eb0cf",
      appBackground: "#121417",
      panelBackground: "#1b1f24",
      cardBackground: "#262b32",
      border: "#3b424c",
      textPrimary: "#f0f3f6",
      textSecondary: "#a8b2bd",
      textMuted: "#6e7782",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "rust-oxide",
    name: "Rust Oxide",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#b7410e",
      accentHover: "#d9531e",
      accentLight: "#f07b42",
      appBackground: "#140c09",
      panelBackground: "#1f130e",
      cardBackground: "#2d1c15",
      border: "#4a2e22",
      textPrimary: "#faf2ed",
      textSecondary: "#d6b8a8",
      textMuted: "#947262",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "emerald-vault",
    name: "Emerald Vault",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#059669",
      accentHover: "#10b981",
      accentLight: "#34d399",
      appBackground: "#02100c",
      panelBackground: "#061c15",
      cardBackground: "#0d2b22",
      border: "#164436",
      textPrimary: "#ecfdf5",
      textSecondary: "#86efac",
      textMuted: "#4b856d",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Violet",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#7c3aed",
      accentHover: "#8b5cf6",
      accentLight: "#c4b5fd",
      appBackground: "#11111b",
      panelBackground: "#181825",
      cardBackground: "#1e1e2e",
      border: "#313244",
      textPrimary: "#cdd6f4",
      textSecondary: "#a6adc8",
      textMuted: "#6c7086",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#5e81ac",
      accentHover: "#81a1c1",
      accentLight: "#88c0d0",
      appBackground: "#242933",
      panelBackground: "#2e3440",
      cardBackground: "#3b4252",
      border: "#4c566a",
      textPrimary: "#eceff4",
      textSecondary: "#d8dee9",
      textMuted: "#9099ab",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "amber-forge",
    name: "Amber Forge",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "dark",
    colors: {
      accentPrimary: "#d97706",
      accentHover: "#f59e0b",
      accentLight: "#fbbf24",
      appBackground: "#0c0a09",
      panelBackground: "#1c1917",
      cardBackground: "#292524",
      border: "#44403c",
      textPrimary: "#fafaf9",
      textSecondary: "#a8a29e",
      textMuted: "#78716c",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
  {
    id: "daylight-clean",
    name: "Daylight Clean",
    author: "FerriVault",
    isBuiltIn: true,
    colorScheme: "light",
    colors: {
      accentPrimary: "#2563eb",
      accentHover: "#1d4ed8",
      accentLight: "#3b82f6",
      appBackground: "#f1f5f9",
      panelBackground: "#ffffff",
      cardBackground: "#e2e8f0",
      border: "#cbd5e1",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
    },
    sizing: { ...DEFAULT_THEME_SIZING },
  },
];

export const DEFAULT_THEME: FerriVaultTheme = BUILTIN_THEMES[0];

/**
 * Parses a `#rrggbb` or `#rgb` hex color string into `[r, g, b]` integers (0–255).
 */
function parseHexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return fallback;
}

/**
 * Mixes two RGB colors (`weight` 0.0 = `c1`, `1.0` = `c2`) and returns `"R G B"`.
 */
function mixRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  weight: number
): string {
  const r = Math.round(c1[0] * (1 - weight) + c2[0] * weight);
  const g = Math.round(c1[1] * (1 - weight) + c2[1] * weight);
  const b = Math.round(c1[2] * (1 - weight) + c2[2] * weight);
  return `${r} ${g} ${b}`;
}

function rgbTupleToString(rgb: [number, number, number]): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(max, Math.max(min, val));
}

/**
 * Applies a `FerriVaultTheme` (and optional sizing overrides) to `document.documentElement`
 * via CSS custom properties.
 */
export function applyThemeToDocument(
  theme: FerriVaultTheme,
  sizingOverride?: Partial<ThemeSizing>
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const c = theme.colors;
  const s: ThemeSizing = {
    baseFontSizePx: clamp(
      sizingOverride?.baseFontSizePx ?? theme.sizing.baseFontSizePx,
      12,
      22
    ),
    borderRadiusPx: clamp(
      sizingOverride?.borderRadiusPx ?? theme.sizing.borderRadiusPx,
      2,
      24
    ),
    sidebarWidthPx: clamp(
      sizingOverride?.sidebarWidthPx ?? theme.sizing.sidebarWidthPx,
      190,
      380
    ),
    listWidthPx: clamp(
      sizingOverride?.listWidthPx ?? theme.sizing.listWidthPx,
      240,
      480
    ),
  };

  const accentPrimary = parseHexToRgb(c.accentPrimary, [23, 93, 220]);
  const accentHover = parseHexToRgb(c.accentHover, [59, 130, 246]);
  const accentLight = parseHexToRgb(c.accentLight, [96, 165, 250]);

  const appBg = parseHexToRgb(c.appBackground, [2, 6, 23]);
  const panelBg = parseHexToRgb(c.panelBackground, [15, 23, 42]);
  const cardBg = parseHexToRgb(c.cardBackground, [30, 41, 59]);
  const border = parseHexToRgb(c.border, [51, 65, 85]);
  const textPrimary = parseHexToRgb(c.textPrimary, [241, 245, 249]);
  const textSecondary = parseHexToRgb(c.textSecondary, [148, 163, 184]);
  const textMuted = parseHexToRgb(c.textMuted, [100, 116, 139]);

  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];

  // Brand scale (50..900)
  root.style.setProperty("--rw-brand-50", mixRgb(accentLight, white, 0.85));
  root.style.setProperty("--rw-brand-100", mixRgb(accentLight, white, 0.7));
  root.style.setProperty("--rw-brand-200", mixRgb(accentLight, white, 0.5));
  root.style.setProperty("--rw-brand-300", mixRgb(accentLight, white, 0.25));
  root.style.setProperty("--rw-brand-400", rgbTupleToString(accentLight));
  root.style.setProperty("--rw-brand-500", rgbTupleToString(accentHover));
  root.style.setProperty("--rw-brand-600", rgbTupleToString(accentPrimary));
  root.style.setProperty("--rw-brand-700", mixRgb(accentPrimary, black, 0.15));
  root.style.setProperty("--rw-brand-800", mixRgb(accentPrimary, black, 0.3));
  root.style.setProperty("--rw-brand-900", mixRgb(accentPrimary, black, 0.45));

  // Surface & Text scale (slate-50..950)
  root.style.setProperty("--rw-slate-50", mixRgb(textPrimary, white, 0.35));
  root.style.setProperty("--rw-slate-100", rgbTupleToString(textPrimary));
  root.style.setProperty("--rw-slate-200", mixRgb(textPrimary, textSecondary, 0.3));
  root.style.setProperty("--rw-slate-300", mixRgb(textPrimary, textSecondary, 0.65));
  root.style.setProperty("--rw-slate-400", rgbTupleToString(textSecondary));
  root.style.setProperty("--rw-slate-500", rgbTupleToString(textMuted));
  root.style.setProperty("--rw-slate-600", mixRgb(textMuted, border, 0.5));
  root.style.setProperty("--rw-slate-700", rgbTupleToString(border));
  root.style.setProperty("--rw-slate-800", rgbTupleToString(cardBg));
  root.style.setProperty("--rw-slate-900", rgbTupleToString(panelBg));
  root.style.setProperty("--rw-slate-950", rgbTupleToString(appBg));

  // Sizing variables
  root.style.setProperty("--rw-font-size", `${s.baseFontSizePx}px`);
  root.style.setProperty("--rw-radius", `${s.borderRadiusPx}px`);
  root.style.setProperty("--rw-sidebar-width", `${s.sidebarWidthPx}px`);
  root.style.setProperty("--rw-list-width", `${s.listWidthPx}px`);

  root.style.fontSize = `${s.baseFontSizePx}px`;
  root.style.colorScheme = theme.colorScheme;
  root.setAttribute("data-color-scheme", theme.colorScheme);
}

function isValidHexColor(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim())
  );
}

/**
 * Validates and normalizes an imported JSON theme string into a `FerriVaultTheme`.
 */
export function parseAndValidateThemeJson(rawJson: string): FerriVaultTheme {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid theme JSON object");
  }

  const name =
    typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim().slice(0, 48)
      : "Custom Theme";

  const rawId =
    typeof parsed.id === "string" && parsed.id.trim().length > 0
      ? parsed.id.trim()
      : name.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");

  // Ensure custom theme ID never collides with built-in theme IDs
  const id = BUILTIN_THEMES.some((b) => b.id === rawId)
    ? `custom-${rawId}-${Date.now().toString(36).slice(-4)}`
    : rawId;

  const colorScheme = parsed.colorScheme === "light" ? "light" : "dark";
  const rawColors =
    typeof parsed.colors === "object" && parsed.colors !== null
      ? (parsed.colors as Record<string, unknown>)
      : {};
  const rawSizing =
    typeof parsed.sizing === "object" && parsed.sizing !== null
      ? (parsed.sizing as Record<string, unknown>)
      : {};

  const fallbackColors = DEFAULT_THEME.colors;
  const colors: ThemeColors = {
    accentPrimary: isValidHexColor(rawColors.accentPrimary)
      ? rawColors.accentPrimary.trim()
      : fallbackColors.accentPrimary,
    accentHover: isValidHexColor(rawColors.accentHover)
      ? rawColors.accentHover.trim()
      : fallbackColors.accentHover,
    accentLight: isValidHexColor(rawColors.accentLight)
      ? rawColors.accentLight.trim()
      : fallbackColors.accentLight,
    appBackground: isValidHexColor(rawColors.appBackground)
      ? rawColors.appBackground.trim()
      : fallbackColors.appBackground,
    panelBackground: isValidHexColor(rawColors.panelBackground)
      ? rawColors.panelBackground.trim()
      : fallbackColors.panelBackground,
    cardBackground: isValidHexColor(rawColors.cardBackground)
      ? rawColors.cardBackground.trim()
      : fallbackColors.cardBackground,
    border: isValidHexColor(rawColors.border)
      ? rawColors.border.trim()
      : fallbackColors.border,
    textPrimary: isValidHexColor(rawColors.textPrimary)
      ? rawColors.textPrimary.trim()
      : fallbackColors.textPrimary,
    textSecondary: isValidHexColor(rawColors.textSecondary)
      ? rawColors.textSecondary.trim()
      : fallbackColors.textSecondary,
    textMuted: isValidHexColor(rawColors.textMuted)
      ? rawColors.textMuted.trim()
      : fallbackColors.textMuted,
  };

  const sizing: ThemeSizing = {
    baseFontSizePx: clamp(
      typeof rawSizing.baseFontSizePx === "number"
        ? rawSizing.baseFontSizePx
        : DEFAULT_THEME_SIZING.baseFontSizePx,
      12,
      22
    ),
    borderRadiusPx: clamp(
      typeof rawSizing.borderRadiusPx === "number"
        ? rawSizing.borderRadiusPx
        : DEFAULT_THEME_SIZING.borderRadiusPx,
      2,
      24
    ),
    sidebarWidthPx: clamp(
      typeof rawSizing.sidebarWidthPx === "number"
        ? rawSizing.sidebarWidthPx
        : DEFAULT_THEME_SIZING.sidebarWidthPx,
      190,
      380
    ),
    listWidthPx: clamp(
      typeof rawSizing.listWidthPx === "number"
        ? rawSizing.listWidthPx
        : DEFAULT_THEME_SIZING.listWidthPx,
      240,
      480
    ),
  };

  return {
    id,
    name,
    author:
      typeof parsed.author === "string" ? parsed.author.trim() : "Custom",
    isBuiltIn: false,
    colorScheme,
    colors,
    sizing,
  };
}

/**
 * Generates a downloadable JSON template based on the provided theme (or default theme)
 * so the user only needs to edit hex color values or pixel sizes.
 */
export function generateThemeTemplateJson(
  baseTheme: FerriVaultTheme = DEFAULT_THEME
): string {
  const template = {
    _comment:
      "FerriVault Theme Template — Edit the hex colors (#RRGGBB) or sizing values (in px) below, save this file, and import it in Settings -> Appearance.",
    id: "my-custom-theme",
    name: `${baseTheme.name} (Custom)`,
    author: "Your Name",
    colorScheme: baseTheme.colorScheme,
    colors: {
      accentPrimary: baseTheme.colors.accentPrimary,
      accentHover: baseTheme.colors.accentHover,
      accentLight: baseTheme.colors.accentLight,
      appBackground: baseTheme.colors.appBackground,
      panelBackground: baseTheme.colors.panelBackground,
      cardBackground: baseTheme.colors.cardBackground,
      border: baseTheme.colors.border,
      textPrimary: baseTheme.colors.textPrimary,
      textSecondary: baseTheme.colors.textSecondary,
      textMuted: baseTheme.colors.textMuted,
    },
    sizing: {
      baseFontSizePx: baseTheme.sizing.baseFontSizePx,
      borderRadiusPx: baseTheme.sizing.borderRadiusPx,
      sidebarWidthPx: baseTheme.sizing.sidebarWidthPx,
      listWidthPx: baseTheme.sizing.listWidthPx,
    },
  };
  return JSON.stringify(template, null, 2);
}
