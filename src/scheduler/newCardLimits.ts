import { AppSettings, Deck, Sm2DeckConfig } from '@/src/models/types';
import { DEFAULT_SETTINGS } from '@/src/constants';

export type NewCardsPerDayMode = 'global' | 'custom';

export function clampNewCardsPerDay(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(9999, Math.round(value)));
}

export function getDeckNewCardsPerDayMode(config: Sm2DeckConfig): NewCardsPerDayMode {
  return config.newCardsPerDayMode ?? 'global';
}

export function getEffectiveNewCardsPerDay(
  deck: Deck,
  settings: Pick<AppSettings, 'defaultNewCardsPerDay'>,
): number {
  const config = deck.config as Sm2DeckConfig;
  if (getDeckNewCardsPerDayMode(config) === 'custom') {
    return clampNewCardsPerDay(config.newCardsPerDay);
  }
  return clampNewCardsPerDay(
    settings.defaultNewCardsPerDay ?? DEFAULT_SETTINGS.defaultNewCardsPerDay,
  );
}
