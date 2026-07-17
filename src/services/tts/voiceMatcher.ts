import { canonicalLocale, CURATED_LOCALES, getLocaleLabel, languagePrefix, normalizeLocale } from './locales';

export interface VoiceInfo {
  identifier: string;
  language: string;
  name: string;
  quality?: string | number;
}

/** iOS often ships Enhanced voices under a different region (e.g. es-ES) than es-MX. */
const SPANISH_REGIONS = new Set(['es-mx', 'es-es', 'es-419', 'es-us', 'es-001', 'es']);

function parseRegionFromIdentifier(identifier: string): string | null {
  const match = identifier.match(
    /voice\.(?:compact|enhanced|premium)\.([a-z]{2}(?:-[a-z0-9]+)?)\./i,
  );
  return match ? normalizeLocale(match[1]).toLowerCase() : null;
}

export function resolveVoiceLocale(voice: VoiceInfo): string {
  const fromId = parseRegionFromIdentifier(voice.identifier);
  const fromLanguage = normalizeLocale(voice.language).toLowerCase();

  // Prefer a specific region from the voice bundle when language is generic (e.g. "es").
  if (fromId && fromId.includes('-')) {
    const idLang = languagePrefix(fromId);
    if (!fromLanguage.includes('-') || languagePrefix(fromLanguage) === idLang) {
      return fromId;
    }
  }

  if (fromLanguage && fromLanguage.length >= 2) return fromLanguage;
  return fromId ?? fromLanguage;
}

function sameLanguageFamily(voiceLocale: string, targetLocale: string): boolean {
  const voiceLang = languagePrefix(voiceLocale);
  const targetLang = languagePrefix(targetLocale);
  if (voiceLang !== targetLang) return false;

  if (voiceLang === 'es') {
    return SPANISH_REGIONS.has(voiceLocale) || SPANISH_REGIONS.has(targetLocale) || true;
  }

  return true;
}

function regionMatchScore(voiceLocale: string, targetLocale: string): number {
  if (voiceLocale === targetLocale) return 40;

  const voiceLang = languagePrefix(voiceLocale);
  const targetLang = languagePrefix(targetLocale);
  if (voiceLang !== targetLang) return 0;

  // Same language, different region (e.g. es-ES voice for es-MX deck)
  if (voiceLang === 'es') return 15;
  if (voiceLang === 'en') return 12;
  if (voiceLang === 'fr') return 12;
  if (voiceLang === 'pt') return 12;
  return 10;
}

function voiceQualityScore(quality?: string | number): number {
  if (quality === 2 || quality === '2') return 45;
  if (!quality) return 0;
  const q = String(quality).toLowerCase();
  if (q === 'premium') return 50;
  if (q === 'enhanced') return 45;
  if (q === 'default') return 5;
  return 0;
}

function voiceNameScore(name: string, identifier: string): number {
  const n = name.toLowerCase();
  const id = identifier.toLowerCase();
  if (n.includes('enhanced') || n.includes('premium') || id.includes('.enhanced.')) return 15;
  if (n.includes('compact') || id.includes('.compact.')) return -20;
  return 0;
}

/** Siri / expressive assistant voices (Rocko, Shelley, …) — not the Spoken Content voices users download. */
export function isAssistantVoice(voice: VoiceInfo): boolean {
  const id = voice.identifier.toLowerCase();
  if (id.includes('eloquence') || id.includes('siri')) return true;

  const name = voice.name.toLowerCase();
  const assistantNames = new Set([
    'rocko',
    'shelley',
    'aaron',
    'nicky',
    'eddie',
    'flo',
    'grandma',
    'grandpa',
    'reed',
  ]);
  return assistantNames.has(name);
}

function hasEnhancedQualityFlag(voice: VoiceInfo): boolean {
  const raw = voice.quality;
  if (raw === 2 || raw === '2') return true;
  const q = String(raw ?? '').toLowerCase();
  return q === 'enhanced' || q === 'premium';
}

/** Which picker section a locale belongs in (separate from bundle detection quirks). */
export function getLocalePickerTier(
  voices: VoiceInfo[],
  locale: string,
  best: VoiceInfo,
): 'enhanced' | 'standard' {
  const id = best.identifier.toLowerCase();
  if (id.includes('.enhanced.') || id.includes('.premium.')) return 'enhanced';
  if (hasEnhancedQualityFlag(best)) return 'enhanced';

  const target = normalizeLocale(locale).toLowerCase();
  const exactVoices = voices.filter((v) => resolveVoiceLocale(v) === target);
  const hasAssistantOnLocale = exactVoices.some(isAssistantVoice);

  // Downloaded non-compact voice (Paulina enhanced bundle, Karen, …)
  if (!isCompactVoice(best) && !isAssistantVoice(best)) return 'enhanced';

  // User's voice beat Siri/eloquence on this locale (e.g. Paulina over Rocko)
  if (!isAssistantVoice(best) && hasAssistantOnLocale) return 'enhanced';

  // Spanish Spoken Content voices are never Siri — treat as Enhanced tier
  if (languagePrefix(locale) === 'es' && !isAssistantVoice(best)) return 'enhanced';

  // Another downloaded enhanced voice exists for this language (e.g. Karen en-AU for en-US)
  if (!isAssistantVoice(best) && hasNonAssistantEnhancedVoice(voices, locale)) {
    return 'enhanced';
  }

  if (isCompactVoice(best)) return 'standard';

  return 'enhanced';
}

function hasNonAssistantEnhancedVoice(voices: VoiceInfo[], locale: string): boolean {
  const targetLang = languagePrefix(locale);
  return voices.some(
    (v) =>
      languagePrefix(resolveVoiceLocale(v)) === targetLang &&
      isEnhancedVoice(v) &&
      !isAssistantVoice(v),
  );
}

function scoreVoiceForSelection(
  voice: VoiceInfo,
  locale: string,
  voices: VoiceInfo[],
): number {
  let score = scoreVoice(voice, locale);
  // No same-language family — do not apply quality bonuses that would
  // incorrectly select an unrelated voice (e.g. English for Japanese).
  if (score <= 0) return 0;

  const id = voice.identifier.toLowerCase();
  if (id.includes('com.apple.voice.enhanced.')) score += 10;

  if (languagePrefix(locale) === 'es') {
    // Always skip Siri/eloquence for Spanish — use downloaded voices (Paulina, Monica, …).
    if (isAssistantVoice(voice)) score -= 1000;
  } else if (isAssistantVoice(voice) && hasNonAssistantEnhancedVoice(voices, locale)) {
    score -= 1000;
  }

  return score;
}

export function scoreVoice(voice: VoiceInfo, locale: string): number {
  const target = normalizeLocale(locale).toLowerCase();
  const voiceLocale = resolveVoiceLocale(voice);

  if (!sameLanguageFamily(voiceLocale, target)) return 0;

  return (
    voiceQualityScore(voice.quality) +
    voiceNameScore(voice.name, voice.identifier) +
    regionMatchScore(voiceLocale, target)
  );
}

export function resolveBestVoice(
  voices: VoiceInfo[],
  locale: string,
): VoiceInfo | null {
  if (voices.length === 0) return null;

  const ranked = voices
    .map((voice) => ({ voice, score: scoreVoiceForSelection(voice, locale, voices) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) return ranked[0].voice;

  // No same-language match — omit voice and let the OS pick for `language`.
  return null;
}

export function getVoicesForExactLocale(
  voices: VoiceInfo[],
  locale: string,
): VoiceInfo[] {
  const target = normalizeLocale(locale).toLowerCase();
  return voices
    .filter((v) => resolveVoiceLocale(v) === target)
    .sort(
      (a, b) =>
        scoreVoiceForSelection(b, target, voices) - scoreVoiceForSelection(a, target, voices),
    );
}

export async function loadAvailableVoices(
  maxRetries = 10,
  delayMs = 1000,
): Promise<VoiceInfo[]> {
  const Speech = await import('expo-speech');
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
    quality: v.quality as string | number | undefined,
  }));
}

export function getVoicesForLocale(
  voices: VoiceInfo[],
  locale: string,
): VoiceInfo[] {
  return voices
    .filter((v) => scoreVoice(v, locale) > 0)
    .sort((a, b) => scoreVoice(b, locale) - scoreVoice(a, locale));
}

export function describeVoice(voice: VoiceInfo | null): string {
  if (!voice) return 'None';
  const locale = resolveVoiceLocale(voice);
  const quality = voice.quality && voice.quality !== 'Default'
    ? ` · ${voice.quality}`
    : '';
  return `${voice.name} (${locale})${quality}`;
}

export function isCompactVoice(voice: VoiceInfo): boolean {
  const id = voice.identifier.toLowerCase();
  return (
    id.includes('.compact.') ||
    id.includes('.super-compact.') ||
    id.includes('_compact') ||
    id.includes('com.apple.voice.compact')
  );
}

export function isEnhancedVoice(voice: VoiceInfo): boolean {
  const id = voice.identifier.toLowerCase();
  if (id.includes('.enhanced.') || id.includes('.premium.')) return true;
  if (id.includes('_enhanced') || id.includes('_premium')) return true;

  if (isCompactVoice(voice)) {
    return hasEnhancedQualityFlag(voice);
  }

  if (hasEnhancedQualityFlag(voice)) return true;

  // Siri / expressive voices are high quality (not compact)
  if (id.includes('eloquence')) return true;
  // Downloaded Apple voice bundles (non-compact) — iOS often reports quality "Default" anyway
  if (id.includes('com.apple.voice.')) return true;
  if (id.includes('com.apple.ttsbundle.') && !id.includes('compact')) return true;

  return false;
}

export interface LocaleVoiceOption {
  locale: string;
  voice: VoiceInfo;
}

export function buildLocaleVoiceOptions(voices: VoiceInfo[]): {
  enhanced: LocaleVoiceOption[];
  standard: LocaleVoiceOption[];
} {
  const enhanced: LocaleVoiceOption[] = [];
  const standard: LocaleVoiceOption[] = [];
  const seen = new Set<string>();

  const addLocale = (locale: string) => {
    const key = normalizeLocale(locale).toLowerCase();
    if (seen.has(key)) return;

    const best = resolveBestVoice(voices, locale);
    if (!best || scoreVoice(best, locale) <= 0) return;

    seen.add(key);

    const entry: LocaleVoiceOption = {
      locale: canonicalLocale(locale),
      voice: best,
    };

    if (getLocalePickerTier(voices, locale, best) === 'enhanced') enhanced.push(entry);
    else standard.push(entry);
  };

  // Known locales first so labels stay familiar (e.g. Spanish Mexico).
  for (const { code } of CURATED_LOCALES) {
    addLocale(code);
  }

  // Any other locales from downloaded voices on this device.
  for (const voice of voices) {
    addLocale(resolveVoiceLocale(voice));
  }

  const sortByLabel = (a: LocaleVoiceOption, b: LocaleVoiceOption) =>
    getLocaleLabel(a.locale).localeCompare(getLocaleLabel(b.locale));

  enhanced.sort(sortByLabel);
  standard.sort(sortByLabel);

  return { enhanced, standard };
}

export function localesMatch(a: string, b: string): boolean {
  return normalizeLocale(a).toLowerCase() === normalizeLocale(b).toLowerCase();
}

export function findVoiceById(
  voices: VoiceInfo[],
  voiceId: string | null | undefined,
): VoiceInfo | null {
  if (!voiceId) return null;
  return voices.find((v) => v.identifier === voiceId) ?? null;
}

export type VoiceQualityBadge = 'Enhanced' | 'Compact' | 'Standard';

export function getVoiceQualityBadge(voice: VoiceInfo): VoiceQualityBadge {
  if (isCompactVoice(voice) && !isEnhancedVoice(voice)) return 'Compact';
  if (isEnhancedVoice(voice)) return 'Enhanced';
  return 'Standard';
}

export interface LanguageOption {
  code: string;
  label: string;
}

export interface RegionOption {
  code: string;
  locale: string;
  label: string;
}

/** Unique languages present on the device, sorted by label. */
export function listLanguagesFromVoices(voices: VoiceInfo[]): LanguageOption[] {
  const byLang = new Map<string, string>();
  for (const voice of voices) {
    const locale = resolveVoiceLocale(voice);
    const lang = languagePrefix(locale);
    if (!lang || byLang.has(lang)) continue;
    byLang.set(lang, getLocaleLabel(lang));
  }
  return [...byLang.entries()]
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Regions for a language code, derived from installed voices. */
export function listRegionsForLanguage(
  voices: VoiceInfo[],
  languageCode: string,
): RegionOption[] {
  const lang = languageCode.toLowerCase();
  const byLocale = new Map<string, RegionOption>();

  for (const voice of voices) {
    const locale = resolveVoiceLocale(voice);
    if (languagePrefix(locale) !== lang) continue;
    const key = locale.toLowerCase();
    if (byLocale.has(key)) continue;
    const canon = canonicalLocale(locale);
    const parts = normalizeLocale(canon).split('-');
    const region = parts[1] ?? '';
    const fullLabel = getLocaleLabel(canon);
    const paren = fullLabel.match(/\((.+)\)\s*$/);
    byLocale.set(key, {
      code: region || canon,
      locale: canon,
      label: paren ? paren[1] : fullLabel,
    });
  }

  // Prefer curated order when available.
  const curated = CURATED_LOCALES.filter(
    (l) => languagePrefix(l.code) === lang && byLocale.has(l.code.toLowerCase()),
  );
  const rest = [...byLocale.values()].filter(
    (r) => !curated.some((c) => c.code.toLowerCase() === r.locale.toLowerCase()),
  );
  rest.sort((a, b) => a.label.localeCompare(b.label));

  return [
    ...curated.map((c) => byLocale.get(c.code.toLowerCase())!),
    ...rest,
  ];
}

/** Split a locale into language + region codes for picker state. */
export function splitLocale(locale: string): { language: string; region: string; locale: string } {
  const canon = canonicalLocale(locale);
  const parts = normalizeLocale(canon).split('-');
  return {
    language: parts[0]?.toLowerCase() ?? 'en',
    region: parts[1] ?? '',
    locale: canon,
  };
}

/**
 * Resolve the voice to show as selected: saved ID if still installed,
 * otherwise the best match for the locale.
 */
export function resolveSelectedVoice(
  voices: VoiceInfo[],
  locale: string,
  voiceId?: string | null,
): VoiceInfo | null {
  const saved = findVoiceById(voices, voiceId);
  if (saved) return saved;
  return resolveBestVoice(voices, locale);
}
