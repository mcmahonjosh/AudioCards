import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFieldsByName,
  fallbackFrontBack,
  renderAnkiTemplate,
  renderCardSides,
} from '../ankiTemplateRenderer';

describe('ankiTemplateRenderer', () => {
  it('renders field tags from templates', () => {
    const fields = buildFieldsByName(
      ['ID', 'Front', 'Back', 'Audio'],
      ['42', 'hola', 'hello', 'clip.mp3'],
    );
    const front = renderAnkiTemplate('{{Front}}', fields);
    const back = renderAnkiTemplate('{{Back}}<br>[sound:{{Audio}}]', fields, front);
    assert.equal(front, 'hola');
    assert.equal(back, 'hello<br>[sound:clip.mp3]');
  });

  it('uses named fields when templates are missing', () => {
    const { front, back } = fallbackFrontBack(
      ['ID', 'Front', 'Back'],
      ['99', 'question', 'answer'],
    );
    assert.equal(front, 'question');
    assert.equal(back, 'answer');
  });

  it('renders card sides from template ord', () => {
    const templates = [
      { qfmt: '{{Word}}', afmt: '{{Definition}}' },
      { qfmt: '{{Word}} reversed', afmt: '{{Definition}} reversed' },
    ];
    const { front, back } = renderCardSides(
      templates,
      0,
      ['Word', 'Definition'],
      ['gato', 'cat'],
    );
    assert.equal(front, 'gato');
    assert.equal(back, 'cat');
  });

  it('hides conditional blocks for empty fields', () => {
    const fields = buildFieldsByName(['Front', 'Hint'], ['hello', '']);
    const html = renderAnkiTemplate('{{Front}}{{#Hint}} ({{Hint}}){{/Hint}}', fields);
    assert.equal(html, 'hello');
  });

  it('injects paired sound fields for phrasal verb deck template', () => {
    const fieldNames = [
      'Phrasal Verb',
      'Prasal Verb-Sound',
      'Definition',
      'Definition-Sound',
      'Examples',
      'Examples-Sound',
    ];
    const values = [
      'let down',
      '[sound:pv.mp3]',
      'to disappoint',
      '[sound:def.mp3]',
      '- You really let me down.',
      '[sound:ex.mp3]',
    ];
    const templates = [
      {
        qfmt: '{{Phrasal Verb}}',
        afmt: '{{Definition}}<hr/>{{Examples}}',
      },
    ];

    const { front, back } = renderCardSides(templates, 0, fieldNames, values);

    assert.equal(front, 'let down<br/>[sound:pv.mp3]');
    assert.match(back, /to disappoint<br\/>\[sound:def\.mp3\]/);
    assert.match(back, /let me down\.<br\/>\[sound:ex\.mp3\]/);
  });
});
