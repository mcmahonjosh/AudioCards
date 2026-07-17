import {
  CardSchedulingState,
  CardPhase,
  Sm2AlgorithmState,
  FsrsAlgorithmState,
  DeckSchedulerConfig,
  Sm2DeckConfig,
  Deck,
  Card,
  ReviewLog,
  Rating,
  AppSettings,
} from '@/src/models/types';
import { DEFAULT_SM2_CONFIG, DEFAULT_SETTINGS } from '@/src/constants';
import type {
  DeckRow,
  CardRow,
  CardSchedulingRow,
  ReviewLogRow,
} from './schema';

export function parseDeckConfig(json: string): DeckSchedulerConfig {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (parsed.algorithm === 'fsrs') {
    return parsed as unknown as DeckSchedulerConfig;
  }
  return normalizeSm2DeckConfig(parsed);
}

/** Merge saved deck config with current defaults; map legacy field names. */
export function normalizeSm2DeckConfig(raw: Record<string, unknown>): Sm2DeckConfig {
  const base = createDefaultDeckConfig();
  const partial = raw as Partial<Sm2DeckConfig> & {
    hardIntervalMultiplier?: number;
    newIntervalOnLapse?: number;
    intervalModifier?: number;
  };

  return {
    ...base,
    ...partial,
    algorithm: 'sm2',
    hardMultiplier:
      partial.hardMultiplier ??
      partial.hardIntervalMultiplier ??
      base.hardMultiplier,
    newIntervalAfterLapse:
      partial.newIntervalAfterLapse ??
      partial.newIntervalOnLapse ??
      base.newIntervalAfterLapse,
    againEasePenalty: partial.againEasePenalty ?? base.againEasePenalty,
    hardEasePenalty: partial.hardEasePenalty ?? base.hardEasePenalty,
    easyEaseBonus: partial.easyEaseBonus ?? base.easyEaseBonus,
    minimumIntervalAfterLapseDays:
      partial.minimumIntervalAfterLapseDays ?? base.minimumIntervalAfterLapseDays,
    learningStepsMinutes: base.learningStepsMinutes,
    relearningStepsMinutes: base.relearningStepsMinutes,
    newCardsPerDayMode: partial.newCardsPerDayMode ?? 'global',
    newCardsPerDay: clampNewCardsPerDay(partial.newCardsPerDay ?? base.newCardsPerDay),
  };
}

function clampNewCardsPerDay(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(9999, Math.round(value)));
}

export function serializeDeckConfig(config: DeckSchedulerConfig): string {
  return JSON.stringify(config);
}

export function rowToDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    frontLocale: row.frontLocale,
    backLocale: row.backLocale,
    frontVoiceId: row.frontVoiceId ?? null,
    backVoiceId: row.backVoiceId ?? null,
    algorithm: row.algorithm as Deck['algorithm'],
    config: parseDeckConfig(row.configJson),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deckId,
    frontText: row.frontText,
    backText: row.backText,
    frontLocale: row.frontLocale,
    backLocale: row.backLocale,
    frontVoiceId: row.frontVoiceId ?? null,
    backVoiceId: row.backVoiceId ?? null,
    contentFormat: (row.contentFormat as Card['contentFormat']) ?? 'plain',
    suspended: row.suspended === 1,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function clampStoredLearningStepIndex(phase: CardPhase, stepIndex: number): number {
  if (phase === 'learning') {
    const maxIndex = DEFAULT_SM2_CONFIG.learningStepsMinutes.length - 1;
    return Math.max(0, Math.min(stepIndex, maxIndex));
  }
  if (phase === 'relearning') {
    const maxIndex = DEFAULT_SM2_CONFIG.relearningStepsMinutes.length - 1;
    return Math.max(0, Math.min(stepIndex, maxIndex));
  }
  return stepIndex;
}

export function rowToScheduling(row: CardSchedulingRow): CardSchedulingState {
  const algorithm = row.algorithm as CardSchedulingState['algorithm'];
  const phase = row.phase as CardPhase;
  let algorithmState: Sm2AlgorithmState | FsrsAlgorithmState;

  if (algorithm === 'fsrs') {
    algorithmState = {
      stability: row.stability ?? 0,
      difficulty: row.difficulty ?? 5,
      elapsedDays: 0,
      scheduledDays: row.scheduledDays ?? 0,
    };
  } else {
    algorithmState = {
      ease: row.ease ?? DEFAULT_SM2_CONFIG.startingEase,
      intervalDays: row.intervalDays,
      learningStepIndex: clampStoredLearningStepIndex(phase, row.learningStepIndex),
      lapseIntervalDays: row.lapseIntervalDays ?? undefined,
    };
  }

  return {
    cardId: row.cardId,
    deckId: row.deckId,
    phase,
    dueAt: new Date(row.dueAt),
    reviewCount: row.reviewCount,
    lapseCount: row.lapseCount,
    lastReviewedAt: row.lastReviewedAt ? new Date(row.lastReviewedAt) : null,
    algorithm,
    algorithmState,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export function schedulingToRow(
  state: CardSchedulingState,
  now: number,
): Omit<CardSchedulingRow, 'createdAt'> & { createdAt?: number } {
  const sm2 =
    state.algorithm === 'sm2'
      ? (state.algorithmState as Sm2AlgorithmState)
      : null;
  const fsrs =
    state.algorithm === 'fsrs'
      ? (state.algorithmState as FsrsAlgorithmState)
      : null;

  return {
    cardId: state.cardId,
    deckId: state.deckId,
    phase: state.phase,
    dueAt: state.dueAt.getTime(),
    reviewCount: state.reviewCount,
    lapseCount: state.lapseCount,
    lastReviewedAt: state.lastReviewedAt?.getTime() ?? null,
    algorithm: state.algorithm,
    ease: sm2?.ease ?? null,
    intervalDays: sm2?.intervalDays ?? fsrs?.scheduledDays ?? 0,
    learningStepIndex: sm2?.learningStepIndex ?? 0,
    lapseIntervalDays: sm2?.lapseIntervalDays ?? null,
    stability: fsrs?.stability ?? null,
    difficulty: fsrs?.difficulty ?? null,
    scheduledDays: fsrs?.scheduledDays ?? null,
    algorithmStateJson: JSON.stringify(state.algorithmState),
    updatedAt: now,
  };
}

export function rowToReviewLog(row: ReviewLogRow): ReviewLog {
  return {
    id: row.id,
    cardId: row.cardId,
    deckId: row.deckId,
    sessionId: row.sessionId ?? undefined,
    reviewedAt: new Date(row.reviewedAt),
    rating: row.rating as Rating,
    phaseBefore: row.phaseBefore as CardPhase,
    easeBefore: row.easeBefore,
    intervalDaysBefore: row.intervalDaysBefore,
    dueAtBefore: new Date(row.dueAtBefore),
    reviewCountBefore: row.reviewCountBefore,
    lapseCountBefore: row.lapseCountBefore,
    phaseAfter: row.phaseAfter as CardPhase,
    easeAfter: row.easeAfter,
    intervalDaysAfter: row.intervalDaysAfter,
    dueAtAfter: new Date(row.dueAtAfter),
    reviewDurationMs: row.reviewDurationMs ?? undefined,
    scheduledDaysLate: row.scheduledDaysLate,
    stabilityBefore: row.stabilityBefore ?? undefined,
    stabilityAfter: row.stabilityAfter ?? undefined,
    difficultyBefore: row.difficultyBefore ?? undefined,
    difficultyAfter: row.difficultyAfter ?? undefined,
    algorithm: row.algorithm as ReviewLog['algorithm'],
  };
}

export function createDefaultDeckConfig(): Sm2DeckConfig {
  return { ...DEFAULT_SM2_CONFIG };
}

export function createDefaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function endOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
