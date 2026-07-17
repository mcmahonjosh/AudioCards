import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { VoiceCommand, CONTEXTUAL_STRINGS } from './commands';
import { parseVoiceCommand } from './commandParser';

export type VoiceCommandListener = (command: VoiceCommand) => void;
export type VoiceStatus = 'idle' | 'listening' | 'unavailable' | 'denied';

const RECOGNITION_RESTART_MS = 50;
/** Ignore duplicate interim/final deliveries of the same command. */
const COMMAND_DEBOUNCE_MS = 700;
/** Drop transcripts for a short window after TTS so speaker echo does not steal the first listen turn. */
const ECHO_FLUSH_MS = 350;

const START_OPTIONS = {
  lang: 'en-US',
  interimResults: true,
  // One utterance at a time — finals arrive faster for short commands like "flip".
  continuous: false,
  requiresOnDeviceRecognition: true,
  // iOS: short confirmation-style commands (yes/no/flip), not dictation.
  iosTaskHint: 'confirmation' as const,
  contextualStrings: CONTEXTUAL_STRINGS,
  addsPunctuation: false,
} as const;

class VoiceCommandServiceImpl {
  private listeners: VoiceCommandListener[] = [];
  private listening = false;
  private paused = false;
  private status: VoiceStatus = 'idle';
  private permissionsGranted: boolean | null = null;
  private lastEmittedCommand: VoiceCommand | null = null;
  private lastEmittedAt = 0;
  private ignoreResultsUntil = 0;

  getStatus(): VoiceStatus {
    return this.status;
  }

  isListening(): boolean {
    return this.listening && !this.paused;
  }

  onCommand(listener: VoiceCommandListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(command: VoiceCommand): void {
    for (const listener of this.listeners) {
      listener(command);
    }
  }

  async requestPermissions(): Promise<boolean> {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    this.permissionsGranted = result.granted;
    return result.granted;
  }

  async getPermissionStatus(): Promise<{
    microphone: boolean;
    speechRecognition: boolean;
  }> {
    const [mic, speech] = await Promise.all([
      ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync(),
      ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync(),
    ]);
    const granted = mic.granted && speech.granted;
    this.permissionsGranted = granted;
    return {
      microphone: mic.granted,
      speechRecognition: speech.granted,
    };
  }

  private async ensurePermissions(): Promise<boolean> {
    if (this.permissionsGranted === true) return true;
    return this.requestPermissions();
  }

  /** Ignore ASR output briefly (e.g. right after TTS) so speaker echo does not consume a listen turn. */
  flushEcho(ms: number = ECHO_FLUSH_MS): void {
    this.ignoreResultsUntil = Date.now() + ms;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[VOICE] echo flush started', { ms });
    }
  }

  async start(): Promise<void> {
    if (this.listening) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] start skipped: service already marked listening');
      }
      return;
    }

    const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!available) {
      this.status = 'unavailable';
      return;
    }

    const granted = await this.ensurePermissions();
    if (!granted) {
      this.status = 'denied';
      return;
    }

    this.listening = true;
    this.paused = false;
    this.status = 'listening';

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[VOICE] requesting native recognizer start');
    }
    ExpoSpeechRecognitionModule.start({ ...START_OPTIONS });
  }

  stop(): void {
    if (!this.listening) return;
    this.listening = false;
    this.paused = false;
    this.status = 'idle';
    ExpoSpeechRecognitionModule.stop();
  }

  pause(): void {
    this.paused = true;
    this.status = 'idle';
    ExpoSpeechRecognitionModule.stop();
  }

  async resume(): Promise<void> {
    const granted = await this.ensurePermissions();
    if (!granted) {
      this.status = 'denied';
      return;
    }

    this.paused = false;
    this.listening = true;
    this.status = 'listening';
    ExpoSpeechRecognitionModule.start({ ...START_OPTIONS });
  }

  handleResult(transcript: string, _isFinal: boolean): void {
    if (!this.listening || this.paused) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] result ignored: service inactive', {
          transcript,
          listening: this.listening,
          paused: this.paused,
        });
      }
      return;
    }
    if (Date.now() < this.ignoreResultsUntil) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] result ignored: echo flush', {
          transcript,
          remainingMs: this.ignoreResultsUntil - Date.now(),
        });
      }
      return;
    }
    const trimmed = transcript.trim();
    if (!trimmed) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] result ignored: empty transcript');
      }
      return;
    }

    const command = parseVoiceCommand(trimmed);
    if (!command) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] transcript did not match command', {
          transcript: trimmed,
          isFinal: _isFinal,
        });
      }
      return;
    }

    const now = Date.now();
    if (
      command === this.lastEmittedCommand &&
      now - this.lastEmittedAt < COMMAND_DEBOUNCE_MS
    ) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] command ignored: duplicate debounce', {
          command,
          elapsedMs: now - this.lastEmittedAt,
        });
      }
      return;
    }
    this.lastEmittedCommand = command;
    this.lastEmittedAt = now;

    // Act on the first matching interim/final — don't wait for silence/finalization.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[VOICE] command emitted', {
        command,
        transcript: trimmed,
        isFinal: _isFinal,
      });
    }
    this.emit(command);
  }

  handleEnd(): void {
    if (this.listening && !this.paused) {
      // Restart for continuous listening
      setTimeout(() => {
        if (this.listening && !this.paused) {
          ExpoSpeechRecognitionModule.start({ ...START_OPTIONS });
        }
      }, RECOGNITION_RESTART_MS);
    }
  }
}

export const voiceCommandService = new VoiceCommandServiceImpl();

export { useSpeechRecognitionEvent };
