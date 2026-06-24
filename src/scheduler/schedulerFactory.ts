import { SchedulerAlgorithm } from '@/src/models/types';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';
import { Sm2Scheduler } from './Sm2Scheduler';

const sm2 = new Sm2Scheduler();

export function getScheduler(algorithm: SchedulerAlgorithm): SpacedRepetitionScheduler {
  if (algorithm === 'fsrs') {
    // FSRS is not implemented yet; use SM-2 so review sessions never crash.
    return sm2;
  }
  return sm2;
}

export const schedulerFactory = { get: getScheduler };
