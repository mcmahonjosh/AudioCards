import {
  CardSchedulingState,
  CardPhase,
  DeckSchedulerConfig,
  IntervalPreview,
  Rating,
  ScheduleResult,
  Sm2AlgorithmState,
  Sm2DeckConfig,
} from '@/src/models/types';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';
import {
  addDays,
  addMinutes,
  clamp,
  daysBetween,
  formatIntervalLabel,
  minutesToDays,
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

function hardDelayMinutes(
  stepIndex: number,
  steps: number[],
  config: Sm2DeckConfig,
): number {
  if (stepIndex === 0) return steps[0];
  const againDelay = steps[0];
  const goodDelay = steps[Math.min(stepIndex, steps.length - 1)];
  return Math.round((againDelay + goodDelay) / 2);
}

function graduateFromLearning(
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
    dueAt: addDays(now, intervalDays),
    algorithmState: {
      ...state,
      ease: state.ease || config.startingEase,
      intervalDays,
      learningStepIndex: 0,
    },
    updatedAt: now,
  };
}

function scheduleLearningSteps(
  card: CardSchedulingState,
  rating: Rating,
  now: Date,
  config: Sm2DeckConfig,
  state: Sm2AlgorithmState,
  steps: number[],
  onGraduate: () => CardSchedulingState,
): ScheduleResult {
  const previous = cloneCard(card);
  let stepIndex = state.learningStepIndex;

  if (rating === 'again') {
    stepIndex = 0;
    const dueAt = addMinutes(now, steps[0]);
    const updated: CardSchedulingState = {
      ...card,
      reviewCount: card.reviewCount + 1,
      lastReviewedAt: now,
      dueAt,
      algorithmState: { ...state, learningStepIndex: stepIndex },
      updatedAt: now,
    };
    return makeResult(updated, previous, minutesToDays(steps[0]));
  }

  if (rating === 'easy') {
    const graduated = onGraduate();
    return makeResult(graduated, previous, config.easyIntervalDays);
  }

  if (rating === 'hard') {
    const delayMin = hardDelayMinutes(stepIndex, steps, config);
    const updated: CardSchedulingState = {
      ...card,
      reviewCount: card.reviewCount + 1,
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
    const graduated = onGraduate();
    return makeResult(graduated, previous, config.graduatingIntervalDays);
  }

  const delayMin = steps[stepIndex];
  const updated: CardSchedulingState = {
    ...card,
    reviewCount: card.reviewCount + 1,
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

    switch (card.phase) {
      case 'new':
        return this.startLearning(card, rating, now, sm2Config, state, previous);
      case 'learning':
        return scheduleLearningSteps(
          card,
          rating,
          now,
          sm2Config,
          state,
          sm2Config.learningStepsMinutes,
          () =>
            graduateFromLearning(
              { ...card, phase: 'learning' },
              state,
              sm2Config,
              now,
              sm2Config.graduatingIntervalDays,
            ),
        );
      case 'relearning':
        return scheduleLearningSteps(
          card,
          rating,
          now,
          sm2Config,
          state,
          sm2Config.relearningStepsMinutes,
          () => {
            const interval =
              state.lapseIntervalDays && state.lapseIntervalDays > 0
                ? state.lapseIntervalDays
                : sm2Config.graduatingIntervalDays;
            return graduateFromLearning(card, state, sm2Config, now, interval);
          },
        );
      case 'review':
        return this.scheduleReview(card, rating, now, sm2Config, state, previous);
      default:
        return makeResult(card, previous, 0);
    }
  }

  private startLearning(
    card: CardSchedulingState,
    rating: Rating,
    now: Date,
    config: Sm2DeckConfig,
    state: Sm2AlgorithmState,
    previous: CardSchedulingState,
  ): ScheduleResult {
    if (rating === 'easy') {
      const graduated = graduateFromLearning(
        { ...card, phase: 'learning' },
        { ...state, ease: config.startingEase },
        config,
        now,
        config.easyIntervalDays,
      );
      return makeResult(graduated, previous, config.easyIntervalDays);
    }

    const learningCard: CardSchedulingState = {
      ...card,
      phase: 'learning',
      algorithmState: { ...state, ease: config.startingEase, learningStepIndex: 0 },
    };

    return scheduleLearningSteps(
      learningCard,
      rating === 'again' ? 'again' : rating,
      now,
      config,
      { ...state, ease: config.startingEase, learningStepIndex: 0 },
      config.learningStepsMinutes,
      () =>
        graduateFromLearning(learningCard, state, config, now, config.graduatingIntervalDays),
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
    const daysLate = Math.max(0, daysBetween(card.dueAt, now));

    if (rating === 'again') {
      const newEase = clamp(ease - 0.2, config.minimumEase, Infinity);
      const lapseInterval = intervalDays * config.newIntervalOnLapse;
      const updated: CardSchedulingState = {
        ...card,
        phase: 'relearning',
        lapseCount: card.lapseCount + 1,
        reviewCount: card.reviewCount + 1,
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

    if (rating === 'hard') ease = clamp(ease - 0.15, config.minimumEase, Infinity);
    if (rating === 'easy') ease = ease + 0.15;

    const hardnessDivider = rating === 'hard' ? 4 : rating === 'good' ? 2 : 1;
    const adjustedInterval = intervalDays + daysLate / hardnessDivider;

    let multiplier =
      rating === 'hard'
        ? config.hardIntervalMultiplier
        : rating === 'easy'
          ? ease * config.easyBonus
          : ease;

    let nextInterval = Math.round(
      adjustedInterval * multiplier * config.intervalModifier,
    );
    nextInterval = Math.min(nextInterval, config.maximumIntervalDays);
    if (intervalDays > 0) {
      nextInterval = Math.max(nextInterval, intervalDays + 1);
    } else {
      nextInterval = Math.max(nextInterval, 1);
    }

    const updated: CardSchedulingState = {
      ...card,
      phase: 'review',
      reviewCount: card.reviewCount + 1,
      lastReviewedAt: now,
      dueAt: addDays(now, nextInterval),
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
      const minutesUntilDue =
        (result.nextDueAt.getTime() - now.getTime()) / (60 * 1000);
      const days = result.nextIntervalDays;
      previews[rating] = {
        rating,
        label: formatIntervalLabel(minutesUntilDue, days),
        dueAt: result.nextDueAt,
        intervalDays: days,
      };
    }

    return previews;
  }
}

export const sm2Scheduler = new Sm2Scheduler();
