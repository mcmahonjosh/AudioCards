import * as Speech from 'expo-speech';
import {
  loadAvailableVoices,
  resolveBestVoice,
  getVoicesForLocale,
  VoiceInfo,
} from './voiceMatcher';

export interface SpeakOptions {
  rate?: number;
  voiceOverride?: string;
}

type SpeakState = 'idle' | 'speaking' | 'paused';

class TtsServiceImpl {
  private voices: VoiceInfo[] = [];
  private initialized = false;
  private state: SpeakState = 'idle';
  private resolveCurrent: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
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

    const voice = options.voiceOverride
      ? this.voices.find((v) => v.identifier === options.voiceOverride)
      : resolveBestVoice(this.voices, locale);

    return new Promise((resolve, reject) => {
      this.resolveCurrent = resolve;
      this.state = 'speaking';

      Speech.speak(text, {
        language: locale,
        voice: voice?.identifier,
        rate: options.rate ?? 1.0,
        onStart: () => {
          this.state = 'speaking';
        },
        onDone: () => {
          this.state = 'idle';
          this.resolveCurrent = null;
          resolve();
        },
        onStopped: () => {
          this.state = 'idle';
          this.resolveCurrent = null;
          resolve();
        },
        onError: (error) => {
          this.state = 'idle';
          this.resolveCurrent = null;
          reject(error);
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
