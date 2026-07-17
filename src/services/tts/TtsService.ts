import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  loadAvailableVoices,
  resolveBestVoice,
  getVoicesForLocale,
  findVoiceById,
  VoiceInfo,
} from './voiceMatcher';
import { buildSpeechOptions } from './speechOptions';

import { configureLoudSpeakerAudio } from '@/src/services/audio/audioSession';
import { SPEECH_VOLUME_SLIDER_DEFAULT } from '@/src/services/tts/volumeUtils';

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

  /**
   * Resolve an installed voice identifier for playback.
   * Validates overrides against the current device list; falls back to the
   * language matcher when stale or missing.
   */
  private resolveVoiceIdentifier(
    locale: string,
    voiceOverride?: string,
  ): string | undefined {
    if (voiceOverride) {
      const stillInstalled = findVoiceById(this.voices, voiceOverride);
      if (stillInstalled) return stillInstalled.identifier;
    }

    return resolveBestVoice(this.voices, locale)?.identifier;
  }

  async speak(
    text: string,
    locale: string,
    options: SpeakOptions = {},
  ): Promise<void> {
    if (!text.trim()) return;
    // Refresh installed voices once so removed iOS downloads cannot break playback.
    if (!this.initialized) {
      await this.initialize();
    }
    await this.stop();

    // Stay on playAndRecord so post-TTS listening does not wait on a category flip.
    configureLoudSpeakerAudio();

    const voiceIdentifier = this.resolveVoiceIdentifier(
      locale,
      options.voiceOverride,
    );

    const speechOptions = buildSpeechOptions({
      locale,
      voiceIdentifier,
      rate: options.rate ?? 1.0,
      volumePercent: options.volume ?? SPEECH_VOLUME_SLIDER_DEFAULT,
    });

    if (__DEV__) {
      console.log('[TTS]', {
        locale,
        voiceIdentifier: speechOptions.voice,
        rate: speechOptions.rate,
        pitch: speechOptions.pitch,
        volume: speechOptions.volume,
      });
    }

    const finish = (resolveFn: () => void) => {
      this.state = 'idle';
      this.resolveCurrent = null;
      // Resolve first so review UI can leave "Speaking..." immediately.
      resolveFn();
    };

    return new Promise((resolve, reject) => {
      this.resolveCurrent = resolve;
      this.state = 'speaking';

      Speech.speak(text, {
        ...speechOptions,
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
