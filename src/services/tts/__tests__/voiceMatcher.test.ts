import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLocaleLabel } from '../locales';
import {
  buildLocaleVoiceOptions,
  findVoiceById,
  getLocalePickerTier,
  getVoicesForExactLocale,
  isCompactVoice,
  isEnhancedVoice,
  listLanguagesFromVoices,
  listRegionsForLanguage,
  resolveBestVoice,
  resolveSelectedVoice,
  resolveVoiceLocale,
  scoreVoice,
  splitLocale,
  VoiceInfo,
} from '../voiceMatcher';

const voices: VoiceInfo[] = [
  {
    identifier: 'com.apple.voice.compact.es-MX.Paulina',
    language: 'es-MX',
    name: 'Paulina',
    quality: 'Default',
  },
  {
    identifier: 'com.apple.voice.enhanced.es-ES.Monica',
    language: 'es-ES',
    name: 'Monica',
    quality: 'Enhanced',
  },
  {
    identifier: 'com.apple.voice.enhanced.es-MX.Paulina',
    language: 'es-MX',
    name: 'Paulina',
    quality: 'Enhanced',
  },
  {
    identifier: 'com.apple.voice.compact.en-US.Samantha',
    language: 'en-US',
    name: 'Samantha',
    quality: 'Default',
  },
  {
    identifier: 'com.apple.voice.enhanced.en-US.Samantha',
    language: 'en-US',
    name: 'Samantha',
    quality: 'Enhanced',
  },
];

describe('resolveBestVoice', () => {
  it('prefers Enhanced es-MX for es-MX locale', () => {
    const voice = resolveBestVoice(voices, 'es-MX');
    assert.equal(voice?.identifier, 'com.apple.voice.enhanced.es-MX.Paulina');
  });

  it('prefers Paulina over Rocko when speaking es-MX', () => {
    const withRocko: VoiceInfo[] = [
      ...voices,
      {
        identifier: 'com.apple.eloquence.es-MX.Rocko',
        language: 'es-MX',
        name: 'Rocko',
        quality: 'Enhanced',
      },
    ];
    const voice = resolveBestVoice(withRocko, 'es-MX');
    assert.equal(voice?.name, 'Paulina');
  });

  it('prefers compact Paulina over Rocko for es-MX even without enhanced quality flag', () => {
    const spanishVoices: VoiceInfo[] = [
      {
        identifier: 'com.apple.voice.compact.es-MX.Paulina',
        language: 'es-MX',
        name: 'Paulina',
        quality: 'Default',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Rocko',
        language: 'es-MX',
        name: 'Rocko',
        quality: 'Enhanced',
      },
    ];
    const voice = resolveBestVoice(spanishVoices, 'es-MX');
    assert.equal(voice?.name, 'Paulina');
  });

  it('prefers Enhanced es-ES over compact es-MX when no Enhanced es-MX exists', () => {
    const subset = voices.filter((v) => v.identifier !== 'com.apple.voice.enhanced.es-MX.Paulina');
    const voice = resolveBestVoice(subset, 'es-MX');
    assert.equal(voice?.identifier, 'com.apple.voice.enhanced.es-ES.Monica');
  });

  it('prefers Enhanced en-US for en-US locale', () => {
    const voice = resolveBestVoice(voices, 'en-US');
    assert.equal(voice?.identifier, 'com.apple.voice.enhanced.en-US.Samantha');
  });

  it('still allows Shelley for en-US when she is the only enhanced voice', () => {
    const englishVoices: VoiceInfo[] = [
      {
        identifier: 'com.apple.voice.compact.en-US.Samantha',
        language: 'en-US',
        name: 'Samantha',
        quality: 'Default',
      },
      {
        identifier: 'com.apple.eloquence.en-US.Shelley',
        language: 'en-US',
        name: 'Shelley',
        quality: 'Enhanced',
      },
    ];
    const voice = resolveBestVoice(englishVoices, 'en-US');
    assert.equal(voice?.name, 'Shelley');
  });

  it('prefers downloaded Enhanced Samantha over Shelley for en-US when both exist', () => {
    const englishVoices: VoiceInfo[] = [
      {
        identifier: 'com.apple.voice.enhanced.en-US.Samantha',
        language: 'en-US',
        name: 'Samantha',
        quality: 'Enhanced',
      },
      {
        identifier: 'com.apple.eloquence.en-US.Shelley',
        language: 'en-US',
        name: 'Shelley',
        quality: 'Enhanced',
      },
    ];
    const voice = resolveBestVoice(englishVoices, 'en-US');
    assert.equal(voice?.identifier, 'com.apple.voice.enhanced.en-US.Samantha');
  });

  it('scores Enhanced cross-region Spanish above compact exact region', () => {
    const enhancedEs = scoreVoice(voices[1], 'es-MX');
    const compactMx = scoreVoice(voices[0], 'es-MX');
    assert.ok(enhancedEs > compactMx);
  });

  it('returns null when no same-language voice exists (omit voice for OS default)', () => {
    const englishOnly = voices.filter((v) => v.language.startsWith('en'));
    assert.equal(resolveBestVoice(englishOnly, 'ja-JP'), null);
  });

  it('falls back to matcher when a saved voice identifier is no longer installed', () => {
    const staleId = 'com.apple.voice.enhanced.es-MX.RemovedVoice';
    assert.equal(findVoiceById(voices, staleId), null);
    const fallback = resolveBestVoice(voices, 'es-MX');
    assert.equal(fallback?.identifier, 'com.apple.voice.enhanced.es-MX.Paulina');
  });
});

describe('buildLocaleVoiceOptions', () => {
  it('puts es-MX in enhanced when Paulina Enhanced is installed', () => {
    const grouped = buildLocaleVoiceOptions(voices);
    const esMx = grouped.enhanced.find((o) => o.locale === 'es-MX');
    assert.ok(esMx, 'es-MX should be in Enhanced section');
    assert.equal(esMx?.voice.identifier, 'com.apple.voice.enhanced.es-MX.Paulina');
  });

  it('puts compact Paulina in Enhanced section when Rocko is on device', () => {
    const deviceVoices: VoiceInfo[] = [
      {
        identifier: 'com.apple.voice.compact.es-MX.Paulina',
        language: 'es-MX',
        name: 'Paulina',
        quality: 'Default',
      },
      {
        identifier: 'com.apple.voice.compact.es-ES.Monica',
        language: 'es-ES',
        name: 'Monica',
        quality: 'Default',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Rocko',
        language: 'es-MX',
        name: 'Rocko',
        quality: 'Enhanced',
      },
      {
        identifier: 'com.apple.eloquence.es-ES.Shelley',
        language: 'es-ES',
        name: 'Shelley',
        quality: 'Enhanced',
      },
    ];
    const grouped = buildLocaleVoiceOptions(deviceVoices);
    const esMx = grouped.enhanced.find((o) => o.locale === 'es-MX');
    const esEs = grouped.enhanced.find((o) => o.locale === 'es-ES');
    assert.equal(esMx?.voice.name, 'Paulina');
    assert.equal(esEs?.voice.name, 'Monica');
    assert.ok(!grouped.standard.some((o) => o.locale === 'es-MX'));
    assert.ok(!grouped.standard.some((o) => o.locale === 'es-ES'));
  });

  it('getLocalePickerTier treats Spanish non-assistant voices as enhanced', () => {
    const paulina: VoiceInfo = {
      identifier: 'com.apple.voice.compact.es-MX.Paulina',
      language: 'es-MX',
      name: 'Paulina',
      quality: 'Default',
    };
    assert.equal(getLocalePickerTier([paulina], 'es-MX', paulina), 'enhanced');
  });

  it('prefers Paulina over Rocko for es-MX in the picker', () => {
    const withRocko: VoiceInfo[] = [
      ...voices,
      {
        identifier: 'com.apple.eloquence.es-MX.Rocko',
        language: 'es-MX',
        name: 'Rocko',
        quality: 'Enhanced',
      },
    ];
    const grouped = buildLocaleVoiceOptions(withRocko);
    const esMx = [...grouped.enhanced, ...grouped.standard].find((o) => o.locale === 'es-MX');
    assert.equal(esMx?.voice.name, 'Paulina');
  });

  it('prefers Monica over Shelley for es-ES in the picker', () => {
    const withShelley: VoiceInfo[] = [
      ...voices.filter((v) => v.language !== 'es-ES'),
      voices.find((v) => v.language === 'es-ES')!,
      {
        identifier: 'com.apple.eloquence.es-ES.Shelley',
        language: 'es-ES',
        name: 'Shelley',
        quality: 'Enhanced',
      },
    ];
    const grouped = buildLocaleVoiceOptions(withShelley);
    const esEs = [...grouped.enhanced, ...grouped.standard].find((o) => o.locale === 'es-ES');
    assert.equal(esEs?.voice.name, 'Monica');
  });

  it('picker voice label matches playback selection for en-US', () => {
    const englishVoices: VoiceInfo[] = [
      {
        identifier: 'com.apple.eloquence.en-US.Flo',
        language: 'en-US',
        name: 'Flo',
        quality: 'Enhanced',
      },
      {
        identifier: 'com.apple.voice.enhanced.en-AU.Karen',
        language: 'en-AU',
        name: 'Karen',
        quality: 'Enhanced',
      },
    ];
    const grouped = buildLocaleVoiceOptions(englishVoices);
    const playback = resolveBestVoice(englishVoices, 'en-US');
    const picker = [...grouped.enhanced, ...grouped.standard].find((o) => o.locale === 'en-US');
    assert.equal(picker?.voice.identifier, playback?.identifier);
    assert.equal(picker?.voice.name, 'Karen');
  });

  it('keeps compact-only locales in standard', () => {
    const compactOnly: VoiceInfo[] = [
      {
        identifier: 'com.apple.voice.compact.bg-BG.Daria',
        language: 'bg-BG',
        name: 'Daria',
        quality: 'Default',
      },
    ];
    const grouped = buildLocaleVoiceOptions(compactOnly);
    assert.equal(grouped.enhanced.length, 0);
    assert.equal(grouped.standard.length, 1);
    assert.equal(grouped.standard[0].locale, 'bg-BG');
  });
});

describe('getLocaleLabel', () => {
  it('labels macro regions and country codes', () => {
    assert.equal(getLocaleLabel('ar-001'), 'Arabic (World)');
    assert.equal(getLocaleLabel('bg-bg'), 'Bulgarian (Bulgaria)');
    assert.equal(getLocaleLabel('es-MX'), 'Spanish (Mexico)');
  });

  it('uses full names when Intl is unavailable', () => {
    assert.equal(getLocaleLabel('en-ie'), 'English (Ireland)');
    assert.equal(getLocaleLabel('ca-es'), 'Catalan (Spain)');
  });

  it('salvages mangled region subtags from iOS', () => {
    assert.equal(getLocaleLabel('ca-eds'), 'Catalan (Spain)');
  });
});

describe('isEnhancedVoice', () => {
  it('treats compact voices as standard tier only when quality is Default', () => {
    const compact: VoiceInfo = {
      identifier: 'com.apple.voice.compact.en-US.Samantha',
      language: 'en-US',
      name: 'Samantha',
      quality: 'Default',
    };
    assert.equal(isCompactVoice(compact), true);
    assert.equal(isEnhancedVoice(compact), false);
  });

  it('detects enhanced bundle when iOS reports Default quality', () => {
    const paulina: VoiceInfo = {
      identifier: 'com.apple.voice.enhanced.es-MX.Paulina',
      language: 'es-MX',
      name: 'Paulina',
      quality: 'Default',
    };
    assert.equal(isEnhancedVoice(paulina), true);
  });

  it('compact voice with Enhanced quality flag counts as enhanced', () => {
    const paulina: VoiceInfo = {
      identifier: 'com.apple.voice.compact.es-MX.Paulina',
      language: 'es-MX',
      name: 'Paulina',
      quality: 'Enhanced',
    };
    assert.equal(isEnhancedVoice(paulina), true);
  });

  it('detects eloquence voices as enhanced', () => {
    const shelley: VoiceInfo = {
      identifier: 'com.apple.eloquence.en-US.Shelley',
      language: 'en-US',
      name: 'Shelley',
      quality: 'Default',
    };
    assert.equal(isEnhancedVoice(shelley), true);
  });
});

describe('resolveVoiceLocale', () => {
  it('uses identifier region when language is generic', () => {
    const voice: VoiceInfo = {
      identifier: 'com.apple.voice.enhanced.es-MX.Paulina',
      language: 'es',
      name: 'Paulina',
      quality: 'Enhanced',
    };
    assert.equal(resolveVoiceLocale(voice), 'es-mx');
  });
});

describe('listLanguagesFromVoices / listRegionsForLanguage', () => {
  it('lists unique languages from installed voices', () => {
    const langs = listLanguagesFromVoices(voices);
    const codes = langs.map((l) => l.code).sort();
    assert.deepEqual(codes, ['en', 'es']);
  });

  it('lists regions for Spanish from installed voices', () => {
    const regions = listRegionsForLanguage(voices, 'es');
    const locales = regions.map((r) => r.locale.toLowerCase()).sort();
    assert.ok(locales.includes('es-mx'));
    assert.ok(locales.includes('es-es'));
  });

  it('lists all voices for an exact locale without collapsing to one', () => {
    const listed = getVoicesForExactLocale(voices, 'es-MX');
    assert.ok(listed.length >= 2);
    assert.ok(listed.some((v) => v.identifier.includes('compact')));
    assert.ok(listed.some((v) => v.identifier.includes('enhanced')));
  });
});

describe('resolveSelectedVoice', () => {
  it('prefers a saved voice identifier when still installed', () => {
    const voice = resolveSelectedVoice(
      voices,
      'en-US',
      'com.apple.voice.compact.en-US.Samantha',
    );
    assert.equal(voice?.identifier, 'com.apple.voice.compact.en-US.Samantha');
  });

  it('falls back to best voice when saved id is missing', () => {
    const voice = resolveSelectedVoice(voices, 'en-US', 'com.apple.voice.missing');
    assert.equal(voice?.identifier, 'com.apple.voice.enhanced.en-US.Samantha');
  });
});

describe('splitLocale', () => {
  it('splits language and region', () => {
    const parts = splitLocale('es-MX');
    assert.equal(parts.language, 'es');
    assert.equal(parts.region.toLowerCase(), 'mx');
    assert.equal(parts.locale, 'es-MX');
  });
});
