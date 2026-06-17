export interface LocaleOption {
  code: string;
  label: string;
}

export const CURATED_LOCALES: LocaleOption[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'es-MX', label: 'Spanish (Mexico)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
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
];

export function getLocaleLabel(code: string): string {
  return CURATED_LOCALES.find((l) => l.code === code)?.label ?? code;
}

export function normalizeLocale(locale: string): string {
  return locale.replace('_', '-');
}

export function languagePrefix(locale: string): string {
  return normalizeLocale(locale).split('-')[0].toLowerCase();
}
