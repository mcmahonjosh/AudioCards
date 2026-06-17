export const DATABASE_NAME = 'audio_cards';

export const DEFAULT_SM2_CONFIG = {
  algorithm: 'sm2' as const,
  learningStepsMinutes: [1, 10, 1440],
  relearningStepsMinutes: [10, 1440],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2.5,
  minimumEase: 1.3,
  maximumIntervalDays: 36500,
  intervalModifier: 1.0,
  hardIntervalMultiplier: 1.2,
  easyBonus: 1.3,
  newIntervalOnLapse: 0.0,
  newCardsPerDay: 20,
};

export const DEFAULT_SETTINGS = {
  speechRate: 1.0,
  autoPlayFront: true,
  autoPlayBack: true,
  handsFreeMode: true,
  defaultFrontLocale: 'en-US',
  defaultBackLocale: 'es-MX',
};
