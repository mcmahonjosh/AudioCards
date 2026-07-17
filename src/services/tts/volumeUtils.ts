import { clamp } from '@/src/scheduler/time';

/** Legacy internal TTS gain range (pre-normalization). Used only for settings migration. */
const TTS_VOLUME_INTERNAL_MIN = 0.5;
const TTS_VOLUME_INTERNAL_MAX = 5.0;

/** UI slider range 0–100. */
export const SPEECH_VOLUME_SLIDER_MIN = 0;
export const SPEECH_VOLUME_SLIDER_MAX = 100;
export const SPEECH_VOLUME_SLIDER_DEFAULT = 60;

/** Convert legacy internal TTS volume to slider position (for settings migration). */
function internalToSliderVolume(internal: number): number {
  const range = TTS_VOLUME_INTERNAL_MAX - TTS_VOLUME_INTERNAL_MIN;
  const ratio = (internal - TTS_VOLUME_INTERNAL_MIN) / range;
  return Math.round(clamp(ratio, 0, 1) * SPEECH_VOLUME_SLIDER_MAX);
}

/** Normalize stored setting: legacy 0.75–2.0 values become 0–100. */
export function normalizeSpeechVolume(stored: number): number {
  if (stored <= TTS_VOLUME_INTERNAL_MAX) {
    return internalToSliderVolume(stored);
  }
  return Math.round(clamp(stored, SPEECH_VOLUME_SLIDER_MIN, SPEECH_VOLUME_SLIDER_MAX));
}
