import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  loadAvailableVoices,
  resolveBestVoice,
  getVoicesForLocale,
  VoiceInfo,
} from './voiceMatcher';

import {
  configureLoudSpeakerAudio,
  configurePlaybackAudio,
} from '@/src/services/audio/audioSession';
import {
  sliderToInternalVolume,
  SPEECH_VOLUME_SLIDER_DEFAULT,
  TTS_VOLUME_INTERNAL_MAX,
  TTS_VOLUME_INTERNAL_MIN,
} from '@/src/services/tts/volumeUtils';
import { clamp } from '@/src/scheduler/time';

export interface SpeakOptions {
  rate?: number;
  /** Slider value 0–100 (100 = loudest). */
  volume?: number;
  voiceOverride?: string;
}

type SpeakState = 'idle' | 'speaking' | 'paused';

class TtsServiceImpl {
  private voices: VoiceInfo[] = [];
  private initialized = false;
  private state: SpeakState = 'idle';
  private resolveCurrent: (() => void) | null = null;

  async initialize(): Promise<void> {
    this.voices = await loadAvailableVoices();
    this.initialized = true;
  }

  getVoices(): VoiceInfo[] {
    return this.voices;
  }

  getVoicesForLocale(locale: string): VoiceInfo[] {
    return getVoicesForLocale(this.voices, locale);
  }

  resolveVoice(locale: string): VoiceInfo | null {
    return resolveBestVoice(this.voices, locale);
  }

  isSpeaking(): boolean {
    return this.state === 'speaking';
  }

  async speak(
    text: string,
    locale: string,
    options: SpeakOptions = {},
  ): Promise<void> {
    if (!text.trim()) return;
    await this.initialize();
    await this.stop();

    configurePlaybackAudio();

    const voice = options.voiceOverride
      ? this.voices.find((v) => v.identifier === options.voiceOverride)
      : resolveBestVoice(this.voices, locale);

    const userVolume = sliderToInternalVolume(
      options.volume ?? SPEECH_VOLUME_SLIDER_DEFAULT,
    );
    const volumeRange = TTS_VOLUME_INTERNAL_MAX - TTS_VOLUME_INTERNAL_MIN;
    const volumeNorm = (userVolume - TTS_VOLUME_INTERNAL_MIN) / volumeRange;
    // iOS native TTS has no volume param — boost pitch for louder perceived output
    const pitch = clamp(1.0 + volumeNorm * 1.0, 1.0, 2.0);
    const webVolume = clamp(0.5 + volumeNorm * 0.5, 0, 1);

    const finish = (resolveFn: () => void) => {
      this.state = 'idle';
      this.resolveCurrent = null;
      configureLoudSpeakerAudio();
      resolveFn();
    };

    return new Promise((resolve, reject) => {
      this.resolveCurrent = resolve;
      this.state = 'speaking';

      Speech.speak(text, {
        language: locale,
        voice: voice?.identifier,
        rate: clamp((options.rate ?? 1.0) * (0.92 + volumeNorm * 0.08), 0.5, 2.0),
        pitch,
        volume: webVolume,
        onStart: () => {
          this.state = 'speaking';
        },
        onDone: () => {
          finish(resolve);
        },
        onStopped: () => {
          finish(resolve);
        },
        onError: (error) => {
          finish(() => reject(error));
        },
      });
    });
  }

  async stop(): Promise<void> {
    if (this.state !== 'idle') {
      Speech.stop();
      this.state = 'idle';
      this.resolveCurrent?.();
      this.resolveCurrent = null;
      if (Platform.OS === 'ios') {
        configureLoudSpeakerAudio();
      }
    }
  }

  pause(): void {
    if (this.state === 'speaking') {
      Speech.pause();
      this.state = 'paused';
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      Speech.resume();
      this.state = 'speaking';
    }
  }
}

export const ttsService = new TtsServiceImpl();
