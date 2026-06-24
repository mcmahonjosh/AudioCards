import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAnkiCardScheduling,
  mapAnkiRevlog,
  mapAnkiRevlogRating,
} from '../ankiSchedulingMapper';

const CRT = 1_700_000_000;

describe('ankiSchedulingMapper', () => {
  it('maps new cards to new phase', () => {
    const result = mapAnkiCardScheduling(
      {
        id: 1,
        nid: 1,
        did: 1,
        ord: 0,
        type: 0,
        queue: 0,
        due: 5,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        left: 0,
      },
      CRT,
      new Date('2025-06-01T12:00:00Z'),
    );
    assert.equal(result.scheduling.phase, 'new');
    assert.equal(result.suspended, false);
  });

  it('maps learning cards with timestamp due', () => {
    const dueSeconds = Math.floor(new Date('2025-06-01T13:00:00Z').getTime() / 1000);
    const result = mapAnkiCardScheduling(
      {
        id: 2,
        nid: 2,
        did: 1,
        ord: 0,
        type: 1,
        queue: 1,
        due: dueSeconds,
        ivl: 0,
        factor: 2500,
        reps: 1,
        lapses: 0,
        left: 2,
      },
      CRT,
      new Date('2025-06-01T12:00:00Z'),
    );
    assert.equal(result.scheduling.phase, 'learning');
    assert.equal(result.scheduling.dueAt.getTime(), dueSeconds * 1000);
  });

  it('decodes packed Anki left field for learning step index', () => {
    const result = mapAnkiCardScheduling(
      {
        id: 5,
        nid: 5,
        did: 1,
        ord: 0,
        type: 1,
        queue: 1,
        due: Math.floor(Date.now() / 1000),
        ivl: 0,
        factor: 2500,
        reps: 2,
        lapses: 0,
        left: 1001,
      },
      CRT,
      new Date(),
    );
    assert.equal(result.scheduling.phase, 'learning');
    if (result.scheduling.algorithm === 'sm2') {
      assert.equal(result.scheduling.algorithmState.learningStepIndex, 1);
    }
  });

  it('maps review cards with day-based due', () => {
    const result = mapAnkiCardScheduling(
      {
        id: 3,
        nid: 3,
        did: 1,
        ord: 0,
        type: 2,
        queue: 2,
        due: 10,
        ivl: 7,
        factor: 2600,
        reps: 5,
        lapses: 1,
        left: 0,
      },
      CRT,
      new Date('2025-06-01T12:00:00Z'),
    );
    assert.equal(result.scheduling.phase, 'review');
    if (result.scheduling.algorithm === 'sm2') {
      assert.equal(result.scheduling.algorithmState.intervalDays, 7);
      assert.equal(result.scheduling.algorithmState.ease, 2.6);
    }
    assert.equal(
      result.scheduling.dueAt.getTime(),
      (CRT + 10 * 86400) * 1000,
    );
  });

  it('marks suspended queue as suspended', () => {
    const result = mapAnkiCardScheduling(
      {
        id: 4,
        nid: 4,
        did: 1,
        ord: 0,
        type: 2,
        queue: -1,
        due: 10,
        ivl: 3,
        factor: 2500,
        reps: 2,
        lapses: 0,
        left: 0,
      },
      CRT,
      new Date(),
    );
    assert.equal(result.suspended, true);
  });

  it('maps revlog ease buttons to ratings', () => {
    assert.equal(mapAnkiRevlogRating(1), 'again');
    assert.equal(mapAnkiRevlogRating(3), 'good');
    assert.equal(mapAnkiRevlogRating(9), null);
  });

  it('maps revlog rows', () => {
    const mapped = mapAnkiRevlog(
      {
        cid: 1,
        usn: 1,
        ease: 3,
        ivl: 7,
        lastIvl: 3,
        factor: 2500,
        time: new Date('2025-06-01T12:00:00Z').getTime(),
        type: 1,
      },
      CRT,
    );
    assert.ok(mapped);
    assert.equal(mapped?.rating, 'good');
    assert.equal(mapped?.intervalDaysBefore, 3);
  });
});
