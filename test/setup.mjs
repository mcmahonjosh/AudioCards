import { mock } from 'node:test';

const platform = { OS: 'ios', select: (choices) => choices.ios };

await mock.module('react-native', {
  defaultExport: { Platform: platform },
  namedExports: {
    Platform: platform,
    StyleSheet: { create: (styles) => styles },
    View: 'View',
    Text: 'Text',
  },
});

await mock.module('expo-speech', {
  namedExports: {
    speak: () => {},
    stop: () => {},
    pause: () => {},
    resume: () => {},
    getAvailableVoicesAsync: async () => [],
    isSpeakingAsync: async () => false,
  },
});

await mock.module('expo-speech-recognition', {
  namedExports: {
    ExpoSpeechRecognitionModule: {
      requestPermissionsAsync: async () => ({ granted: true }),
      getMicrophonePermissionsAsync: async () => ({ granted: true }),
      getSpeechRecognizerPermissionsAsync: async () => ({ granted: true }),
      isRecognitionAvailable: () => false,
      start: () => {},
      stop: () => {},
    },
    useSpeechRecognitionEvent: () => {},
  },
});
