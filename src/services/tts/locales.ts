import {
  LANGUAGE_NAMES,
  MACRO_REGION_LABELS,
  normalizeRegionSubtag,
  REGION_NAMES,
} from './localeLabels';

export interface LocaleOption {
  code: string;
  label: string;
}

export const CURATED_LOCALES: LocaleOption[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-IE', label: 'English (Ireland)' },
  { code: 'ca-ES', label: 'Catalan (Spain)' },
  { code: 'es-MX', label: 'Spanish (Mexico)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'es-419', label: 'Spanish (Latin America)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'fr-CA', label: 'French (Canada)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'it-IT', label: 'Italian (Italy)' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { code: 'ar-001', label: 'Arabic (World)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'nl-NL', label: 'Dutch (Netherlands)' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'sv-SE', label: 'Swedish' },
  { code: 'tr-TR', label: 'Turkish' },
  { code: 'vi-VN', label: 'Vietnamese' },
  { code: 'th-TH', label: 'Thai' },
  { code: 'id-ID', label: 'Indonesian' },
  { code: 'cs-CZ', label: 'Czech' },
  { code: 'da-DK', label: 'Danish' },
  { code: 'fi-FI', label: 'Finnish' },
  { code: 'el-GR', label: 'Greek' },
  { code: 'he-IL', label: 'Hebrew' },
  { code: 'hu-HU', label: 'Hungarian' },
  { code: 'nb-NO', label: 'Norwegian' },
  { code: 'ro-RO', label: 'Romanian' },
  { code: 'uk-UA', label: 'Ukrainian' },
  { code: 'bg-BG', label: 'Bulgarian (Bulgaria)' },
];

const MACRO_REGION_LABELS_LOCAL = MACRO_REGION_LABELS;

let languageDisplay: Intl.DisplayNames | null = null;
let regionDisplay: Intl.DisplayNames | null = null;

function intlReturnedCode(input: string, result: string | undefined): boolean {
  if (!result) return true;
  return result.toLowerCase() === input.toLowerCase();
}

function getLanguageDisplay(): Intl.DisplayNames | null {
  if (languageDisplay) return languageDisplay;
  try {
    languageDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
    return languageDisplay;
  } catch {
    return null;
  }
}

function getRegionDisplay(): Intl.DisplayNames | null {
  if (regionDisplay) return regionDisplay;
  try {
    regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionDisplay;
  } catch {
    return null;
  }
}

function displayLanguage(code: string): string {
  const fromIntl = getLanguageDisplay()?.of(code);
  if (fromIntl && !intlReturnedCode(code, fromIntl)) return fromIntl;
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code;
}

function displayRegion(code: string): string {
  const upper = code.toUpperCase();
  const fromIntl = getRegionDisplay()?.of(upper);
  if (fromIntl && !intlReturnedCode(upper, fromIntl)) return fromIntl;
  return REGION_NAMES[upper] ?? upper;
}

export function getLocaleLabel(code: string): string {
  const norm = normalizeLocale(code);
  const lower = norm.toLowerCase();
  const curated = CURATED_LOCALES.find((l) => l.code.toLowerCase() === lower);
  if (curated) return curated.label;

  const parts = lower.split('-');
  const lang = parts[0];
  const rawRegion = parts[1];
  const langName = displayLanguage(lang);

  if (!rawRegion) return langName;

  const region = normalizeRegionSubtag(rawRegion);

  if (/^\d{3}$/.test(region)) {
    const macro = MACRO_REGION_LABELS_LOCAL[region];
    return macro ? `${langName} (${macro})` : langName;
  }

  const regionName = displayRegion(region);
  return `${langName} (${regionName})`;
}

export function canonicalLocale(locale: string): string {
  const norm = normalizeLocale(locale).toLowerCase();
  const curated = CURATED_LOCALES.find((l) => l.code.toLowerCase() === norm);
  if (curated) return curated.code;

  const parts = norm.split('-');
  if (parts.length === 2 && !/^\d{3}$/.test(parts[1])) {
    return `${parts[0]}-${parts[1].toUpperCase()}`;
  }
  return normalizeLocale(locale);
}

export function normalizeLocale(locale: string): string {
  return locale.replace('_', '-');
}

export function languagePrefix(locale: string): string {
  return normalizeLocale(locale).split('-')[0].toLowerCase();
}
