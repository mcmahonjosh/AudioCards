import { clamp } from '@/src/scheduler/time';

/** Internal TTS gain range. Max is boosted for louder output on device speaker. */
export const TTS_VOLUME_INTERNAL_MIN = 0.5;
export const TTS_VOLUME_INTERNAL_MAX = 5.0;
export const TTS_VOLUME_INTERNAL_DEFAULT = 2.2;

/** UI slider range 0–100. */
export const SPEECH_VOLUME_SLIDER_MIN = 0;
export const SPEECH_VOLUME_SLIDER_MAX = 100;
export const SPEECH_VOLUME_SLIDER_DEFAULT = 60;

/** Convert slider position (0–100) to internal TTS volume. */
export function sliderToInternalVolume(slider: number): number {
  const s = clamp(slider, SPEECH_VOLUME_SLIDER_MIN, SPEECH_VOLUME_SLIDER_MAX);
  const range = TTS_VOLUME_INTERNAL_MAX - TTS_VOLUME_INTERNAL_MIN;
  return TTS_VOLUME_INTERNAL_MIN + (s / SPEECH_VOLUME_SLIDER_MAX) * range;
}

/** Convert internal TTS volume to slider position (for legacy settings migration). */
export function internalToSliderVolume(internal: number): number {
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
