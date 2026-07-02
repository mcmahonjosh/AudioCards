export const DATABASE_NAME = 'audio_cards';

export const DEFAULT_SM2_CONFIG = {
  algorithm: 'sm2' as const,
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2.5,
  minimumEase: 1.3,
  maximumIntervalDays: 36500,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  againEasePenalty: 0.2,
  hardEasePenalty: 0.15,
  easyEaseBonus: 0.15,
  newIntervalAfterLapse: 0,
  minimumIntervalAfterLapseDays: 1,
  newCardsPerDay: 20,
};

export const DEFAULT_SETTINGS = {
  speechRate: 1.0,
  speechVolume: 60,
  autoPlayFront: true,
  autoPlayBack: true,
  handsFreeMode: true,
  defaultFrontLocale: 'en-US',
  defaultBackLocale: 'es-MX',
  defaultNewCardsPerDay: 20,
  safetyNoticeAcknowledged: false,
  voiceIntroAcknowledged: false,
};
