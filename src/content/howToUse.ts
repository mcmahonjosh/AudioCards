export const VOICE_COMMANDS = [
  { command: 'flip', description: 'Reveal the back of the card' },
  { command: 'repeat', description: 'Replay the current side' },
  { command: 'again / hard / good / easy', description: 'Rate the card (after flipping)' },
  { command: 'pause / resume', description: 'Pause or resume the session' },
  { command: 'end session', description: 'End the review session' },
] as const;

export const VOICE_INTRO_PARAGRAPHS = [
  'Audio Cards reads each card aloud using your iPhone’s built-in text-to-speech voices. Hands-free mode is on by default so you can control review with voice commands.',
  'During a session the app listens for short commands after each side is spoken. Touch controls always work as a backup. Turn off Hands-free mode in Settings if you prefer to tap only.',
];

export const VOICE_TTS_HINT =
  'For clearer audio, download Enhanced voices in iPhone Settings → Accessibility → Spoken Content → Voices.';

export const HOW_TO_USE_SECTIONS = [
  {
    title: 'Getting started',
    body: [
      'Create a deck from the home screen, then add cards manually or import from CSV or Anki (.apkg).',
      'Open a deck and tap Start Review when cards are due. Tap Flip to see the answer, then rate how well you knew it.',
    ],
  },
  {
    title: 'Voice commands',
    body: [
      'Hands-free mode is on by default. Start a review and say a command after the app finishes speaking (or while the back is shown for ratings).',
      ...VOICE_COMMANDS.map((c) => `• ${c.command} — ${c.description}`),
      'Microphone and speech recognition permissions are requested when you start a hands-free review (or when you turn the setting on in Settings).',
    ],
  },
  {
    title: 'Text-to-speech voices',
    body: [
      'Card text is spoken with your device’s installed voices — the same system voices used by Accessibility features on iPhone.',
      'Choose front and back languages per deck or in Settings. The app picks the best matching voice for each language.',
      VOICE_TTS_HINT,
      'Adjust speech rate and volume in Settings. Use Preview Voice to hear your current settings.',
    ],
  },
  {
    title: 'Study limits',
    body: [
      'Set a default new-cards-per-day limit in Settings. Each deck can follow the global limit or use its own limit in Scheduler settings on the deck screen.',
    ],
  },
] as const;
