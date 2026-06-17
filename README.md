# Audio Cards

A local-first, voice-first flashcard app for language learning built with React Native and Expo.

## Features

- **Hands-free review**: Voice commands (flip, repeat, again, hard, good, easy, pause, end)
- **Local TTS**: Device text-to-speech with locale-aware voice matching
- **Spaced repetition**: Anki-like SM-2 scheduler with 4 rating buttons
- **100% offline**: SQLite storage, no backend required
- **Stats & charts**: Daily reviews, rating breakdown, due forecast, deck progress
- **CSV import**: Import cards from CSV files locally
- **Anki import**: Architecture placeholder for future `.apkg` support

## Requirements

- Node.js 18+
- EAS CLI for development builds (`npm install -g eas-cli`)
- Physical device recommended for voice command testing

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
eas build --profile development --platform android

# Or build locally
npx expo run:android
npx expo run:ios
```

Install the development build on your device, then connect to Metro.

## Voice Commands

During review, say:
- **flip** — reveal the back of the card
- **repeat** — replay current side audio
- **again / hard / good / easy** — rate the card
- **pause / resume** — pause or resume the session
- **end** — end the review session

Touch controls are always available as fallback.

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
```

## Tech Stack

- Expo SDK 52 + Expo Router
- expo-sqlite + Drizzle ORM
- expo-speech (TTS)
- expo-speech-recognition (voice commands)
- react-native-gifted-charts
