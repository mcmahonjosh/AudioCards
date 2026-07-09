# Audio Cards

A local-first, voice-first flashcard app for language learning built with React Native and Expo.

## Features

- **Hands-free review**: Voice commands (flip, repeat, again, hard, good, easy, pause, end)
- **Local TTS**: Device text-to-speech with locale-aware voice matching
- **Spaced repetition**: Anki-like SM-2 scheduler with 4 rating buttons
- **100% offline**: SQLite storage, no backend required
- **Stats & charts**: Daily reviews, rating breakdown, due forecast, deck progress
- **CSV import**: Import cards from CSV files locally
- **Anki import**: Import `.apkg` decks with HTML, media, and scheduling (cloze note types not supported)

## Requirements

- Node.js 18+
- EAS CLI for device builds (`npm install -g eas-cli`)
- Physical iPhone recommended for voice command testing
- Apple Developer Program membership for App Store distribution

## Setup

```bash
npm install
```

## Development

This app requires a **development build** (not Expo Go) because speech recognition uses native modules.

```bash
# Start Metro bundler
npm start

# Create development build (cloud)
eas build --profile development --platform ios

# Or build locally
npx expo run:ios
```

Install the development build on your device, then connect to Metro.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
```

## Production release (iOS)

```bash
# Build for App Store
npm run build:ios

# Submit to App Store Connect (after TestFlight QA)
npm run submit:ios
```

Configure `ascAppId` in `eas.json` under `submit.production` after creating the app in App Store Connect.

## Privacy

Privacy policy: [https://mcmahonjosh.github.io/AudioCards/privacy](https://mcmahonjosh.github.io/AudioCards/privacy)

Support: [https://mcmahonjosh.github.io/AudioCards/support](https://mcmahonjosh.github.io/AudioCards/support)

The in-app Settings screen uses the same URLs (configured in `app.config.ts`).

## Voice Commands

During review, say:
- **flip** — reveal the back of the card
- **repeat** — replay current side audio
- **again / hard / good / easy** — rate the card
- **pause / resume** — pause or resume the session
- **end** — end the review session

Touch controls are always available as fallback. Microphone permission is requested when you enable hands-free mode, not at app launch.

## CSV Import Format

```csv
front,back,tags,front_locale,back_locale
Hello,Hola,greetings,en-US,es-MX
```

Only `front` and `back` columns are required.

## Project Structure

```
app/           Expo Router screens
src/db/        SQLite schema & repositories
src/scheduler/ SM-2 spaced repetition (FSRS-ready)
src/services/  TTS, voice commands, import
src/review/    Review session controller
src/stats/     Stats aggregation
src/components/ Reusable UI
docs/          Privacy policy (GitHub Pages)
```

## Tech Stack

- Expo SDK 52 + Expo Router
- expo-sqlite + Drizzle ORM
- expo-speech (TTS)
- expo-speech-recognition (voice commands)
- react-native-gifted-charts
