import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import ca from "./locales/ca.json";

/**
 * Metadata definition for each supported locale in FerriVault.
 * Community contributors can add a new language by:
 * 1. Creating `src/i18n/locales/<code>.json` (matching the structure of `en.json`).
 * 2. Importing it above and appending an entry to `SUPPORTED_LOCALES`.
 */
export interface LocaleMetadata {
  /** ISO 639-1 language code */
  code: string;
  /** English display name */
  name: string;
  /** Native display name */
  nativeName: string;
  /** Translation dictionary */
  translation: typeof en;
}

export const SUPPORTED_LOCALES: readonly LocaleMetadata[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    translation: en,
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    translation: es,
  },
  {
    code: "ca",
    name: "Catalan",
    nativeName: "Català",
    translation: ca,
  },
] as const;

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

export const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "ferrivault_locale";

/**
 * Detects the initial locale from localStorage or browser/OS preferences,
 * falling back to English (`en`) if unsupported.
 */
export function detectInitialLocale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
      return saved;
    }
    const navLang = navigator.language?.split("-")[0]?.toLowerCase();
    if (navLang && SUPPORTED_LOCALES.some((l) => l.code === navLang)) {
      return navLang;
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return DEFAULT_LOCALE;
}

/**
 * Persists the chosen locale code to localStorage and switches the active i18next language.
 */
export async function setAppLocale(code: string): Promise<void> {
  const validCode = SUPPORTED_LOCALES.some((l) => l.code === code)
    ? code
    : DEFAULT_LOCALE;
  try {
    localStorage.setItem(STORAGE_KEY, validCode);
  } catch {
    // Ignore storage errors
  }
  await i18n.changeLanguage(validCode);
}

/**
 * Returns the localized strings needed by the native OS system tray menu
 * for the active language.
 */
export function getTrayLabelsForLocale(code?: string): {
  showWindow: string;
  openGenerator: string;
  syncVault: string;
  lockVault: string;
  quit: string;
} {
  const target = code ?? i18n.language ?? DEFAULT_LOCALE;
  const localeObj =
    SUPPORTED_LOCALES.find((l) => l.code === target) ?? SUPPORTED_LOCALES[0];
  return localeObj.translation.tray;
}

const resources = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale.code,
    { translation: locale.translation },
  ])
);

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
