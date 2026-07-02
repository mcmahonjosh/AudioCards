import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chartSeriesKey } from '../chartAxis';

describe('chartSeriesKey', () => {
  it('changes when series values change', () => {
    const a = chartSeriesKey([1, 2, 3]);
    const b = chartSeriesKey([1, 2, 4]);
    assert.notEqual(a, b);
  });

  it('is stable for identical values', () => {
    assert.equal(chartSeriesKey([5, 0, 2]), chartSeriesKey([5, 0, 2]));
  });
});
