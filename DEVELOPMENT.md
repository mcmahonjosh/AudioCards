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

## Automated Tests

### Unit and integration tests

```bash
npm test
npm run test:watch
npm run typecheck
npm run lint
```

CI runs lint, typecheck, and the full Node test suite on every push/PR.

### Maestro E2E (device / simulator)

Prerequisites: dev client installed, Metro running (`npm start`), [Maestro CLI](https://maestro.mobile.dev/) installed.

```bash
maestro test .maestro/
```

Flows cover launch, deck creation, add card, touch review, end session, stats deck filter, and settings smoke. Voice/hands-free paths remain manual (see checklist below).

## Manual QA Checklist (voice + platform)

Run on a **physical iPhone** with a dev build after automated tests pass:

- [ ] Safety notice + voice intro modals (first launch)
- [ ] Hands-free: flip, good/hard/easy/again, pause/resume, end
- [ ] TTS echo does not auto-rate (post-fix verification)
- [ ] APKG import with media
- [ ] Offline: airplane mode, review + stats still work
- [ ] Session end stays on complete screen (regression)
- [ ] Stats deck filter: numbers **and** bars match

## Production Build

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```
