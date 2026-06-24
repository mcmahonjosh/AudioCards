import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePastedText } from '../pastedTextImporter';

describe('pastedTextImporter', () => {
  it('parses comma-separated rows on new lines', () => {
    const result = parsePastedText('hello,world\nfoo,bar', {
      colSeparator: 'comma',
      rowSeparator: 'newline',
    });
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], { front: 'hello', back: 'world', lineNumber: 1 });
    assert.deepEqual(result.rows[1], { front: 'foo', back: 'bar', lineNumber: 2 });
  });

  it('parses tab-separated Excel-style paste', () => {
    const result = parsePastedText('hola\thello\nperro\tdog', {
      colSeparator: 'custom',
      customColSeparator: '\t',
      rowSeparator: 'newline',
    });
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], { front: 'hola', back: 'hello', lineNumber: 1 });
  });

  it('parses semicolon row separator with comma columns', () => {
    const result = parsePastedText('hello,world;foo,bar', {
      colSeparator: 'comma',
      rowSeparator: 'semicolon',
    });
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[1], { front: 'foo', back: 'bar', lineNumber: 2 });
  });

  it('parses custom delimiters', () => {
    const result = parsePastedText('hello :: world | foo :: bar', {
      colSeparator: 'custom',
      customColSeparator: ' :: ',
      rowSeparator: 'custom',
      customRowSeparator: ' | ',
    });
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], { front: 'hello', back: 'world', lineNumber: 1 });
  });

  it('handles quoted commas inside fields', () => {
    const result = parsePastedText('"hello, there",world', {
      colSeparator: 'comma',
      rowSeparator: 'newline',
    });
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].front, 'hello, there');
    assert.equal(result.rows[0].back, 'world');
  });

  it('skips first row when header toggle is on', () => {
    const result = parsePastedText('Spanish,English\nhola,hello', {
      colSeparator: 'comma',
      rowSeparator: 'newline',
      skipFirstRow: true,
    });
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0], { front: 'hola', back: 'hello', lineNumber: 2 });
  });

  it('reports invalid rows with fewer than two columns', () => {
    const result = parsePastedText('onlyone\nhello,world', {
      colSeparator: 'comma',
      rowSeparator: 'newline',
    });
    assert.equal(result.rows.length, 1);
    assert.equal(result.skippedEmpty, 1);
    assert.match(result.errors[0], /Row 1/);
  });

  it('reports empty front or back', () => {
    const result = parsePastedText('hello,\nfoo,bar', {
      colSeparator: 'comma',
      rowSeparator: 'newline',
    });
    assert.equal(result.rows.length, 1);
    assert.equal(result.skippedEmpty, 1);
  });

  it('requires custom column separator when selected', () => {
    const result = parsePastedText('a,b', {
      colSeparator: 'custom',
      rowSeparator: 'newline',
    });
    assert.equal(result.configError, 'Enter a column separator');
    assert.equal(result.rows.length, 0);
  });
});
