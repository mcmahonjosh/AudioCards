import { CardPhase } from '@/src/models/types';

export const MATURE_INTERVAL_DAYS = 21;

export function isYoung(intervalDays: number): boolean {
  return intervalDays < MATURE_INTERVAL_DAYS;
}

export function isMature(intervalDays: number): boolean {
  return intervalDays >= MATURE_INTERVAL_DAYS;
}

export type ReviewCategory = 'learning' | 'young' | 'mature' | 'relearn';

export function classifyReviewCategory(
  phaseBefore: CardPhase | string,
  intervalDaysBefore: number,
): ReviewCategory {
  if (phaseBefore === 'relearning') return 'relearn';
  if (phaseBefore === 'learning' || phaseBefore === 'new') return 'learning';
  if (phaseBefore === 'review') {
    return isMature(intervalDaysBefore) ? 'mature' : 'young';
  }
  return 'learning';
}

export type AnswerButtonGroup = 'learning' | 'young' | 'mature';

export function classifyAnswerButtonGroup(
  phaseBefore: CardPhase | string,
  intervalDaysBefore: number,
): AnswerButtonGroup {
  if (phaseBefore === 'relearning' || phaseBefore === 'learning' || phaseBefore === 'new') {
    return 'learning';
  }
  if (phaseBefore === 'review') {
    return isMature(intervalDaysBefore) ? 'mature' : 'young';
  }
  return 'learning';
}

export type CardCountCategory =
  | 'new'
  | 'learning'
  | 'relearning'
  | 'young'
  | 'mature'
  | 'suspended';

export function classifyCardCountCategory(
  phase: CardPhase | string,
  intervalDays: number,
  suspended: boolean,
): CardCountCategory {
  if (suspended) return 'suspended';
  switch (phase) {
    case 'new':
      return 'new';
    case 'learning':
      return 'learning';
    case 'relearning':
      return 'relearning';
    case 'review':
      return isMature(intervalDays) ? 'mature' : 'young';
    default:
      return 'new';
  }
}
