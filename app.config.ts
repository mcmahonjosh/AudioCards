import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Audio Cards',
  slug: 'audio-cards',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'audiocards',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1a1a2e',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.joshuamcmahon.audiocards',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSSpeechRecognitionUsageDescription:
        'Audio Cards uses speech recognition when Hands-Free Mode is on to understand review commands such as "flip", "repeat", "good", or "pause". Commands are processed on your device and are not saved or sent to us.',
      NSMicrophoneUsageDescription:
        'Audio Cards uses the microphone only when Hands-Free Mode is on during review. Say commands like "flip" to reveal the answer, "good" to rate a card, or "end" to finish. Audio is processed on-device and is not recorded or sent to our servers.',
      NSPhotoLibraryUsageDescription:
        'Audio Cards lets you import flashcard decks and media from files on your device. Photo library access is only used when you choose an image or deck file to import.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#1a1a2e',
    },
    package: 'com.joshuamcmahon.audiocards',
    permissions: ['android.permission.RECORD_AUDIO'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-asset',
    'expo-sqlite',
    [
      'expo-speech-recognition',
      {
        microphonePermission:
          'Audio Cards uses the microphone only when Hands-Free Mode is on during review. Say commands like "flip" to reveal the answer, "good" to rate a card, or "end" to finish. Audio is processed on-device and is not recorded or sent to our servers.',
        speechRecognitionPermission:
          'Audio Cards uses speech recognition when Hands-Free Mode is on to understand review commands such as "flip", "repeat", "good", or "pause". Commands are processed on your device and are not saved or sent to us.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '2405c646-aa9c-4406-a60d-bddbe14310d3',
    },
    privacyPolicyUrl: 'https://mcmahonjosh.github.io/AudioCards/privacy',
    supportUrl: 'https://mcmahonjosh.github.io/AudioCards/support',
  },
});
