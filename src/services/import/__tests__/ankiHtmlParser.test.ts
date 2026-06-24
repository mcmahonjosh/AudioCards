import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSoundFilenames,
  extractImageFilenames,
  stripHtmlForTts,
  plainTextPreview,
  preprocessAnkiHtml,
  sanitizeAnkiHtmlForRender,
  textForSideTts,
} from '../../media/ankiHtmlParser';

describe('ankiHtmlParser', () => {
  it('extracts sound filenames in order', () => {
    const names = extractSoundFilenames('Hello [sound:a.mp3] world [sound:b.ogg]');
    assert.deepEqual(names, ['a.mp3', 'b.ogg']);
  });

  it('extracts image filenames', () => {
    const names = extractImageFilenames('<img src="photo.jpg"> and <img src="x.png">');
    assert.deepEqual(names, ['photo.jpg', 'x.png']);
  });

  it('strips HTML for TTS', () => {
    const plain = stripHtmlForTts('<b>Hello</b><br/>[sound:test.mp3] world');
    assert.equal(plain, 'Hello\nworld');
  });

  it('preprocesses sound tags into custom elements', () => {
    const html = preprocessAnkiHtml('[sound:clip.mp3]');
    assert.match(html, /anki-sound/);
    assert.match(html, /clip\.mp3/);
  });

  it('builds one-line plain preview', () => {
    const preview = plainTextPreview('Line one\nLine two', 'plain');
    assert.equal(preview, 'Line one Line two');
  });

  it('strips unsupported Anki HTML chrome', () => {
    const html = sanitizeAnkiHtmlForRender(
      '<link rel="stylesheet" href="_style.css"><button>Play</button><a href="about:blank">text</a>',
    );
    assert.doesNotMatch(html, /link|button|about:blank/);
    assert.match(html, /text/);
  });

  it('speaks only back-specific text when front is repeated on back', () => {
    const front = 'perro';
    const back = 'perro<hr/>dog';
    const tts = textForSideTts('back', front, back, 'html');
    assert.equal(stripHtmlForTts(tts), 'dog');
  });

  it('keeps full back when front is not duplicated', () => {
    const front = 'perro';
    const back = 'a domestic animal<hr/>common pet';
    const tts = textForSideTts('back', front, back, 'html');
    assert.equal(stripHtmlForTts(tts), 'a domestic animal\ncommon pet');
  });

  it('drops front section with paired sound on back', () => {
    const front = 'hola';
    const back = 'hola<br/>[sound:hola.mp3]<hr/>hello';
    const tts = textForSideTts('back', front, back, 'html');
    assert.equal(stripHtmlForTts(tts), 'hello');
    assert.doesNotMatch(tts, /hola\.mp3/);
  });
});
