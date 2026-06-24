import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyField,
  enrichWithPairedMedia,
  findParentField,
  normalizeFieldValue,
  normalizeAllFieldValues,
} from '../ankiFieldLayout';

const PHRASAL_FIELD_NAMES = [
  'Phrasal Verb',
  'Prasal Verb-Sound',
  'Definition',
  'Definition-Sound',
  'image',
  'Definición',
  'Examples',
  'Examples-Sound',
];

describe('ankiFieldLayout', () => {
  it('classifies sound fields by name and value', () => {
    assert.equal(classifyField('Definition-Sound', '[sound:def.mp3]'), 'audio');
    assert.equal(classifyField('Prasal Verb-Sound', 'clip.mp3'), 'audio');
    assert.equal(classifyField('Definition', 'to disappoint'), 'text');
    assert.equal(classifyField('image', 'photo.jpg'), 'image');
    assert.equal(classifyField('Note', ''), 'skip');
  });

  it('normalizes bare audio filenames', () => {
    assert.equal(normalizeFieldValue('clip.mp3'), '[sound:clip.mp3]');
    assert.equal(normalizeFieldValue('[sound:already.mp3]'), '[sound:already.mp3]');
  });

  it('pairs typo sound field with parent text field', () => {
    const parent = findParentField('Prasal Verb-Sound', PHRASAL_FIELD_NAMES);
    assert.equal(parent, 'Phrasal Verb');
    assert.equal(findParentField('Definition-Sound', PHRASAL_FIELD_NAMES), 'Definition');
    assert.equal(findParentField('Examples-Sound', PHRASAL_FIELD_NAMES), 'Examples');
  });

  it('injects paired audio after parent content on template-rendered sides', () => {
    const values = [
      'let down',
      '[sound:pv.mp3]',
      'to disappoint',
      '[sound:def.mp3]',
      'pic.jpg',
      'Decepcionar',
      '- You really let me down.',
      '[sound:ex.mp3]',
    ];

    const { front, back } = enrichWithPairedMedia(
      'let down',
      'to disappoint<hr/>- You really let me down.',
      PHRASAL_FIELD_NAMES,
      values,
    );

    assert.match(front, /let down/);
    assert.match(front, /\[sound:pv\.mp3\]/);
    assert.match(back, /to disappoint/);
    assert.match(back, /\[sound:def\.mp3\]/);
    assert.match(back, /\[sound:ex\.mp3\]/);
    assert.match(back, /<img[^>]+pic\.jpg/);
  });

  it('normalizeAllFieldValues wraps bare audio in field list', () => {
    const normalized = normalizeAllFieldValues(
      ['Audio'],
      ['file.ogg'],
    );
    assert.equal(normalized[0], '[sound:file.ogg]');
  });
});
