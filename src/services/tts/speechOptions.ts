import type { SpeechOptions } from 'expo-speech';

export type BuildSpeechOptionsParams = {
  locale: string;
  voiceIdentifier?: string | null;
  rate: number;
  volumePercent: number;
};

/**
 * Build normalized expo-speech options.
 * Volume, rate, and pitch are independent — volume never affects pitch or rate.
 */
export function buildSpeechOptions({
  locale,
  voiceIdentifier,
  rate,
  volumePercent,
}: BuildSpeechOptionsParams): SpeechOptions {
  const normalizedVolume = Math.max(0, Math.min(1, volumePercent / 100));
  const normalizedRate = Math.max(0.5, Math.min(1.5, rate));

  const options: SpeechOptions = {
    language: locale,
    rate: normalizedRate,
    pitch: 1.0,
    volume: normalizedVolume,
  };

  if (voiceIdentifier) {
    options.voice = voiceIdentifier;
  }

  return options;
}
