import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
} from 'expo-speech-recognition';

/** Route TTS through the loud speaker (not the earpiece) on iOS. */
export function configureLoudSpeakerAudio(): void {
  if (Platform.OS !== 'ios') return;

  try {
    ExpoSpeechRecognitionModule.setCategoryIOS({
      category: AVAudioSessionCategory.playAndRecord,
      categoryOptions: [
        AVAudioSessionCategoryOptions.defaultToSpeaker,
        AVAudioSessionCategoryOptions.allowBluetooth,
        AVAudioSessionCategoryOptions.allowBluetoothA2DP,
      ],
      mode: AVAudioSessionMode.spokenAudio,
    });
    ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(true, {
      notifyOthersOnDeactivation: true,
    });
  } catch {
    // Non-fatal if audio session setup fails
  }
}

/** Playback-only session can be louder than playAndRecord during TTS. */
export function configurePlaybackAudio(): void {
  if (Platform.OS !== 'ios') return;

  try {
    ExpoSpeechRecognitionModule.setCategoryIOS({
      category: AVAudioSessionCategory.playback,
      categoryOptions: [
        AVAudioSessionCategoryOptions.defaultToSpeaker,
        AVAudioSessionCategoryOptions.allowBluetooth,
        AVAudioSessionCategoryOptions.allowBluetoothA2DP,
      ],
      mode: AVAudioSessionMode.spokenAudio,
    });
    ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(true, {
      notifyOthersOnDeactivation: true,
    });
  } catch {
    configureLoudSpeakerAudio();
  }
}
