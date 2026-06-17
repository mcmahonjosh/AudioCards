# Development Build Guide

Audio Cards requires a **development build** because `expo-speech-recognition` includes native iOS/Android code not available in Expo Go.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

3. Update `app.config.ts` → `extra.eas.projectId` with your EAS project ID:
   ```bash
   eas init
   ```

## Build Development Client

### Android (APK — easiest for testing)

```bash
eas build --profile development --platform android
```

Download and install the APK on your device.

### iOS (Simulator)

```bash
eas build --profile development --platform ios
```

### Local build (requires Android Studio / Xcode)

```bash
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

## Run the App

1. Start Metro with dev-client flag (already in package.json):
   ```bash
   npm start
   ```

2. Open the **Audio Cards** dev client app on your device (not Expo Go).

3. Scan the QR code or enter the Metro URL.

## Testing Voice Commands

Voice recognition works best on a **physical device** with a quiet environment.

1. Grant microphone and speech recognition permissions in Settings.
2. Enable **Hands-free mode** in app Settings.
3. Start a review session.
4. Wait for "Listening for commands..." after TTS finishes.
5. Say commands: flip, repeat, good, again, pause, end.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find native module 'ExpoSpeechRecognition'` | You're using Expo Go — install the dev build |
| No TTS voices on Android | Wait a few seconds; voices load async on first launch |
| Mic conflicts with TTS on iOS | App pauses recognition during speech automatically |
| Empty review queue | Add cards or wait for due cards; new cards count toward daily limit |

## Production Build

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```
