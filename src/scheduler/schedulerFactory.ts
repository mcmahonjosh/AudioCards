import { SchedulerAlgorithm } from '@/src/models/types';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';
import { Sm2Scheduler } from './Sm2Scheduler';
import { FsrsScheduler } from './FsrsScheduler';

const sm2 = new Sm2Scheduler();
const fsrs = new FsrsScheduler();

export function getScheduler(algorithm: SchedulerAlgorithm): SpacedRepetitionScheduler {
  switch (algorithm) {
    case 'fsrs':
      return fsrs;
    case 'sm2':
    default:
      return sm2;
  }
}

export const schedulerFactory = { get: getScheduler };
