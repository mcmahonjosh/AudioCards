import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  formatDueAt,
  formatNextReviewLabel,
} from '../time';

const now = new Date('2025-06-01T12:00:00');

describe('addCalendarDays', () => {
  it('snaps to local midnight on the target day', () => {
    const result = addCalendarDays(now, 2);
    assert.equal(result.getHours(), 0);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getDate(), 3);
  });
});

describe('formatDueAt', () => {
  it('returns now for overdue cards', () => {
    assert.equal(formatDueAt(new Date('2025-05-31T12:00:00'), now), 'now');
  });

  it('labels tomorrow and later today', () => {
    assert.equal(formatDueAt(new Date('2025-06-02T08:00:00'), now), 'tomorrow');
    assert.equal(formatDueAt(new Date('2025-06-01T18:00:00'), now), 'later today');
  });
});

describe('formatNextReviewLabel', () => {
  it('formats sub-day delays in minutes', () => {
    assert.equal(formatNextReviewLabel(new Date('2025-06-01T12:10:00'), now), '10m');
  });

  it('formats multi-day delays in days', () => {
    assert.equal(formatNextReviewLabel(new Date('2025-06-04T12:00:00'), now), '3d');
  });
});
