import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvContent } from '../csvImporter';

describe('csvImporter', () => {
  it('parses named front and back columns with header row', () => {
    const { rows, errors } = parseCsvContent('front,back\nhello,world');
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].front, 'hello');
    assert.equal(rows[0].back, 'world');
  });

  it('uses first two columns when front and back headers are missing', () => {
    const { rows, errors } = parseCsvContent('hola,hello\nperro,dog');
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { front: 'hola', back: 'hello' });
    assert.deepEqual(rows[1], { front: 'perro', back: 'dog' });
  });

  it('handles quoted commas in positional mode', () => {
    const { rows } = parseCsvContent('"hello, there",world');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].front, 'hello, there');
    assert.equal(rows[0].back, 'world');
  });

  it('parses tab-separated files without comma columns', () => {
    const { rows } = parseCsvContent('hola\thello\nperro\tdog');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { front: 'hola', back: 'hello' });
  });
});
