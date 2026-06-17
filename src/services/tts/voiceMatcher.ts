import * as Speech from 'expo-speech';
import { languagePrefix, normalizeLocale } from './locales';

export interface VoiceInfo {
  identifier: string;
  language: string;
  name: string;
  quality?: string;
}

function localeMatches(voiceLang: string, target: string): boolean {
  const v = normalizeLocale(voiceLang).toLowerCase();
  const t = normalizeLocale(target).toLowerCase();
  return v === t;
}

function languageMatches(voiceLang: string, target: string): boolean {
  return languagePrefix(voiceLang) === languagePrefix(target);
}

export function resolveBestVoice(
  voices: VoiceInfo[],
  locale: string,
): VoiceInfo | null {
  if (voices.length === 0) return null;

  const exact = voices.find((v) => localeMatches(v.language, locale));
  if (exact) return exact;

  const prefix = languagePrefix(locale);
  const sameLanguage = voices.filter((v) => languageMatches(v.language, locale));
  if (sameLanguage.length > 0) {
    const regionMatch = sameLanguage.find((v) =>
      normalizeLocale(v.language).toLowerCase().startsWith(prefix),
    );
    return regionMatch ?? sameLanguage[0];
  }

  return voices[0];
}

export async function loadAvailableVoices(
  maxRetries = 10,
  delayMs = 1000,
): Promise<VoiceInfo[]> {
  let voices = await Speech.getAvailableVoicesAsync();

  if (voices.length === 0) {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      voices = await Speech.getAvailableVoicesAsync();
      if (voices.length > 0) break;
    }
  }

  return voices.map((v) => ({
    identifier: v.identifier,
    language: v.language,
    name: v.name,
    quality: v.quality,
  }));
}

export function getVoicesForLocale(
  voices: VoiceInfo[],
  locale: string,
): VoiceInfo[] {
  const sameLanguage = voices.filter((v) => languageMatches(v.language, locale));
  if (sameLanguage.length > 0) return sameLanguage;
  return voices.filter((v) => localeMatches(v.language, locale));
}
