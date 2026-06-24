import {
  CardSchedulingState,
  DeckSchedulerConfig,
  IntervalPreview,
  Rating,
  ScheduleResult,
  Sm2AlgorithmState,
  Sm2DeckConfig,
} from '@/src/models/types';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';
import {
  addMinutes,
  clamp,
  formatAnkiRatingButtonLabel,
  minutesToDays,
  scheduleReviewDue,
} from './time';

function getSm2State(card: CardSchedulingState): Sm2AlgorithmState {
  return card.algorithmState as Sm2AlgorithmState;
}

function cloneCard(card: CardSchedulingState): CardSchedulingState {
  return {
    ...card,
    dueAt: new Date(card.dueAt),
    lastReviewedAt: card.lastReviewedAt ? new Date(card.lastReviewedAt) : null,
    algorithmState: { ...getSm2State(card) },
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt),
  };
}

function makeResult(
  card: CardSchedulingState,
  previous: CardSchedulingState,
  nextIntervalDays: number,
): ScheduleResult {
  return {
    card,
    previousPhase: previous.phase,
    previousDueAt: previous.dueAt,
    nextIntervalDays,
    nextDueAt: card.dueAt,
  };
}

function graduateToReview(
  card: CardSchedulingState,
  state: Sm2AlgorithmState,
  config: Sm2DeckConfig,
  now: Date,
  intervalDays: number,
): CardSchedulingState {
  return {
    ...card,
    phase: 'review',
    reviewCount: card.reviewCount + 1,
    lastReviewedAt: now,
    dueAt: scheduleReviewDue(now, intervalDays),
    algorithmState: {
      ...state,
      ease: state.ease || config.startingEase,
      intervalDays,
      learningStepIndex: 0,
      lapseIntervalDays: undefined,
    },
    updatedAt: now,
  };
}

function clampLearningStepIndex(stepIndex: number, steps: number[]): number {
  if (steps.length === 0) return 0;
  return Math.max(0, Math.min(stepIndex, steps.length - 1));
}

function resolveStepDelayMinutes(stepIndex: number, steps: number[]): number {
  if (steps.length === 0) return 1;
  const clamped = clampLearningStepIndex(stepIndex, steps);
  const delay = steps[clamped];
  if (Number.isFinite(delay)) return delay;
  const fallback = steps[0];
  return Number.isFinite(fallback) ? fallback : 1;
}

function hardLearningDelayMinutes(stepIndex: number, steps: number[]): number {
  const clamped = clampLearningStepIndex(stepIndex, steps);
  if (clamped === 0) {
    if (steps.length >= 2) {
      const first = steps[0];
      const second = steps[1];
      if (Number.isFinite(first) && Number.isFinite(second)) {
        return Math.round((first + second) / 2);
      }
    }
    return Math.round(resolveStepDelayMinutes(0, steps) * 1.5);
  }
  return resolveStepDelayMinutes(clamped, steps);
}

function scheduleLearningSteps(
  card: CardSchedulingState,
  rating: Rating,
  now: Date,
  config: Sm2DeckConfig,
  state: Sm2AlgorithmState,
  steps: number[],
  options: {
    phase: 'learning' | 'relearning';
    repeatHardStep?: boolean;
    onGoodGraduate: () => CardSchedulingState;
    onEasyGraduate: () => CardSchedulingState;
  },
): ScheduleResult {
  const previous = cloneCard(card);
  let stepIndex = clampLearningStepIndex(state.learningStepIndex, steps);

  if (rating === 'again') {
    const delayMin = resolveStepDelayMinutes(0, steps);
    const updated: CardSchedulingState = {
      ...card,
      phase: options.phase,
      lastReviewedAt: now,
      dueAt: addMinutes(now, delayMin),
      algorithmState: { ...state, learningStepIndex: 0 },
      updatedAt: now,
    };
    return makeResult(updated, previous, minutesToDays(delayMin));
  }

  if (rating === 'easy') {
    const graduated = options.onEasyGraduate();
    const intervalDays = getSm2State(graduated).intervalDays;
    return makeResult(graduated, previous, intervalDays);
  }

  if (rating === 'hard') {
    const delayMin = options.repeatHardStep
      ? resolveStepDelayMinutes(stepIndex, steps)
      : hardLearningDelayMinutes(stepIndex, steps);
    const updated: CardSchedulingState = {
      ...card,
      phase: options.phase,
      lastReviewedAt: now,
      dueAt: addMinutes(now, delayMin),
      algorithmState: { ...state, learningStepIndex: stepIndex },
      updatedAt: now,
    };
    return makeResult(updated, previous, minutesToDays(delayMin));
  }

  // good
  stepIndex += 1;
  if (stepIndex >= steps.length) {
    const graduated = options.onGoodGraduate();
    const intervalDays = getSm2State(graduated).intervalDays;
    return makeResult(graduated, previous, intervalDays);
  }

  const delayMin = resolveStepDelayMinutes(stepIndex, steps);
  const updated: CardSchedulingState = {
    ...card,
    phase: options.phase,
    lastReviewedAt: now,
    dueAt: addMinutes(now, delayMin),
    algorithmState: { ...state, learningStepIndex: stepIndex },
    updatedAt: now,
  };
  return makeResult(updated, previous, minutesToDays(delayMin));
}

export class Sm2Scheduler implements SpacedRepetitionScheduler {
  readonly algorithm = 'sm2' as const;

  isNewCard(card: CardSchedulingState): boolean {
    return card.phase === 'new' && card.reviewCount === 0;
  }

  isDue(card: CardSchedulingState, now: Date): boolean {
    return card.dueAt.getTime() <= now.getTime();
  }

  createInitialState(
    cardId: string,
    deckId: string,
    now: Date,
    config: DeckSchedulerConfig,
  ): CardSchedulingState {
    const sm2Config = config as Sm2DeckConfig;
    return {
      cardId,
      deckId,
      phase: 'new',
      dueAt: now,
      reviewCount: 0,
      lapseCount: 0,
      lastReviewedAt: null,
      algorithm: 'sm2',
      algorithmState: {
        ease: sm2Config.startingEase,
        intervalDays: 0,
        learningStepIndex: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  scheduleCard(
    card: CardSchedulingState,
    rating: Rating,
    now: Date,
    config: DeckSchedulerConfig,
  ): ScheduleResult {
    const sm2Config = config as Sm2DeckConfig;
    const state = getSm2State(card);
    const previous = cloneCard(card);

    if (card.phase === 'new') {
      const learningCard: CardSchedulingState = {
        ...card,
        phase: 'learning',
        algorithmState: {
          ...state,
          ease: state.ease || sm2Config.startingEase,
          learningStepIndex: 0,
        },
      };
      return this.scheduleLearning(learningCard, rating, now, sm2Config);
    }

    switch (card.phase) {
      case 'learning':
        return this.scheduleLearning(card, rating, now, sm2Config);
      case 'relearning':
        return this.scheduleRelearning(card, rating, now, sm2Config, state);
      case 'review':
        return this.scheduleReview(card, rating, now, sm2Config, state, previous);
      default:
        return makeResult(card, previous, 0);
    }
  }

  private scheduleLearning(
    card: CardSchedulingState,
    rating: Rating,
    now: Date,
    config: Sm2DeckConfig,
  ): ScheduleResult {
    const state = getSm2State(card);

    return scheduleLearningSteps(
      card,
      rating,
      now,
      config,
      state,
      config.learningStepsMinutes,
      {
        phase: 'learning',
        onGoodGraduate: () =>
          graduateToReview(
            { ...card, phase: 'learning' },
            state,
            config,
            now,
            config.graduatingIntervalDays,
          ),
        onEasyGraduate: () =>
          graduateToReview(
            { ...card, phase: 'learning' },
            state,
            config,
            now,
            config.easyIntervalDays,
          ),
      },
    );
  }

  private scheduleRelearning(
    card: CardSchedulingState,
    rating: Rating,
    now: Date,
    config: Sm2DeckConfig,
    state: Sm2AlgorithmState,
  ): ScheduleResult {
    const lapseInterval = Math.max(
      config.minimumIntervalAfterLapseDays,
      state.intervalDays,
    );

    return scheduleLearningSteps(
      card,
      rating,
      now,
      config,
      state,
      config.relearningStepsMinutes,
      {
        phase: 'relearning',
        repeatHardStep: true,
        onGoodGraduate: () =>
          graduateToReview(card, state, config, now, lapseInterval),
        onEasyGraduate: () =>
          graduateToReview(card, state, config, now, lapseInterval),
      },
    );
  }

  private scheduleReview(
    card: CardSchedulingState,
    rating: Rating,
    now: Date,
    config: Sm2DeckConfig,
    state: Sm2AlgorithmState,
    previous: CardSchedulingState,
  ): ScheduleResult {
    let { ease, intervalDays } = state;

    if (rating === 'again') {
      const newEase = clamp(ease - config.againEasePenalty, config.minimumEase, Infinity);
      const lapseInterval = Math.max(
        config.minimumIntervalAfterLapseDays,
        Math.round(intervalDays * config.newIntervalAfterLapse),
      );
      const updated: CardSchedulingState = {
        ...card,
        phase: 'relearning',
        lapseCount: card.lapseCount + 1,
        lastReviewedAt: now,
        dueAt: addMinutes(now, config.relearningStepsMinutes[0]),
        algorithmState: {
          ease: newEase,
          intervalDays: lapseInterval,
          learningStepIndex: 0,
          lapseIntervalDays: lapseInterval,
        },
        updatedAt: now,
      };
      return makeResult(
        updated,
        previous,
        minutesToDays(config.relearningStepsMinutes[0]),
      );
    }

    if (rating === 'hard') {
      ease = clamp(ease - config.hardEasePenalty, config.minimumEase, Infinity);
    } else if (rating === 'easy') {
      ease = ease + config.easyEaseBonus;
    }

    let nextInterval: number;
    if (rating === 'hard') {
      nextInterval = Math.max(1, Math.round(intervalDays * config.hardMultiplier));
    } else if (rating === 'good') {
      nextInterval = Math.max(1, Math.round(intervalDays * ease));
    } else {
      nextInterval = Math.max(1, Math.round(intervalDays * ease * config.easyBonus));
    }

    nextInterval = Math.min(nextInterval, config.maximumIntervalDays);

    const updated: CardSchedulingState = {
      ...card,
      phase: 'review',
      reviewCount: card.reviewCount + 1,
      lastReviewedAt: now,
      dueAt: scheduleReviewDue(now, nextInterval),
      algorithmState: { ease, intervalDays: nextInterval, learningStepIndex: 0 },
      updatedAt: now,
    };
    return makeResult(updated, previous, nextInterval);
  }

  previewIntervals(
    card: CardSchedulingState,
    now: Date,
    config: DeckSchedulerConfig,
  ): Record<Rating, IntervalPreview> {
    const ratings: Rating[] = ['again', 'hard', 'good', 'easy'];
    const previews = {} as Record<Rating, IntervalPreview>;

    for (const rating of ratings) {
      const result = this.scheduleCard(cloneCard(card), rating, now, config);
      previews[rating] = {
        rating,
        label: formatAnkiRatingButtonLabel(rating, result.nextDueAt, now),
        dueAt: result.nextDueAt,
        intervalDays: result.nextIntervalDays,
      };
    }

    return previews;
  }
}

export const sm2Scheduler = new Sm2Scheduler();
