import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { VoiceCommand, CONTEXTUAL_STRINGS } from './commands';
import { parseVoiceCommand } from './commandParser';

export type VoiceCommandListener = (command: VoiceCommand) => void;
export type VoiceStatus = 'idle' | 'listening' | 'unavailable' | 'denied';

class VoiceCommandServiceImpl {
  private listeners: VoiceCommandListener[] = [];
  private listening = false;
  private paused = false;
  private status: VoiceStatus = 'idle';

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
    return {
      microphone: mic.granted,
      speechRecognition: speech.granted,
    };
  }

  async start(): Promise<void> {
    if (this.listening) return;

    const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!available) {
      this.status = 'unavailable';
      return;
    }

    const granted = await this.requestPermissions();
    if (!granted) {
      this.status = 'denied';
      return;
    }

    this.listening = true;
    this.paused = false;
    this.status = 'listening';

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      contextualStrings: CONTEXTUAL_STRINGS,
      addsPunctuation: false,
    });
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
    this.paused = false;
    this.status = 'listening';
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      contextualStrings: CONTEXTUAL_STRINGS,
      addsPunctuation: false,
    });
  }

  handleResult(transcript: string, isFinal: boolean): void {
    if (!this.listening || this.paused) return;
    if (!isFinal && transcript.split(' ').length < 1) return;

    const command = parseVoiceCommand(transcript);
    if (command) {
      this.emit(command);
    }
  }

  handleEnd(): void {
    if (this.listening && !this.paused) {
      // Restart for continuous listening
      setTimeout(() => {
        if (this.listening && !this.paused) {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
            requiresOnDeviceRecognition: true,
            contextualStrings: CONTEXTUAL_STRINGS,
          });
        }
      }, 300);
    }
  }
}

export const voiceCommandService = new VoiceCommandServiceImpl();

export { useSpeechRecognitionEvent };
