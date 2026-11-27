import en from './en.json';
import ms from './ms.json';

/**
 * Screen text lives in one file per language (en.json, ms.json). Screens will call t('key') once the language switcher is built.
 * Until then nothing calls it, so every screen keeps its English text. A missing key falls back to English, then to the key itself.
 */
export const LOCALES = { en, ms } as const;
export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = 'en';

export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  const table = LOCALES[locale] as Record<string, string>;
  return table[key] ?? (LOCALES[DEFAULT_LOCALE] as Record<string, string>)[key] ?? key;
}
