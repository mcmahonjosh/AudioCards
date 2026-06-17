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
        'Audio Cards uses speech recognition for hands-free voice commands during review.',
      NSMicrophoneUsageDescription:
        'Audio Cards uses the microphone for hands-free voice commands during review.',
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
        microphonePermission: 'Allow Audio Cards to use the microphone for voice commands.',
        speechRecognitionPermission: 'Allow Audio Cards to recognize voice commands.',
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
  },
});
