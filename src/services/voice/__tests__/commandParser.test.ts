import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand, ratingFromCommand } from '../commandParser';

describe('commandParser', () => {
  it('parses flip command', () => {
    assert.equal(parseVoiceCommand('flip'), 'flip');
    assert.equal(parseVoiceCommand('show answer'), 'flip');
  });

  it('parses rating commands', () => {
    assert.equal(parseVoiceCommand('good'), 'good');
    assert.equal(parseVoiceCommand('easy'), 'easy');
    assert.equal(parseVoiceCommand('again'), 'again');
    assert.equal(parseVoiceCommand('that was easy'), null);
    assert.equal(parseVoiceCommand('this is a good example'), null);
  });

  it('parses session commands', () => {
    assert.equal(parseVoiceCommand('pause'), 'pause');
    assert.equal(parseVoiceCommand('end session'), 'end');
    assert.equal(parseVoiceCommand('end'), null);
    assert.equal(parseVoiceCommand('done'), null);
    assert.equal(parseVoiceCommand('quit'), null);
    assert.equal(parseVoiceCommand('finish'), null);
  });

  it('returns null for unrecognized input', () => {
    assert.equal(parseVoiceCommand('hello world'), null);
  });

  it('does not match long card or TTS phrases for rating or end commands', () => {
    assert.equal(parseVoiceCommand('this is a good example sentence'), null);
    assert.equal(parseVoiceCommand('that was easy to remember today'), null);
    assert.equal(parseVoiceCommand('please end the session now thanks'), null);
    assert.equal(parseVoiceCommand('the word good appears in this long phrase'), null);
    assert.equal(parseVoiceCommand('Davido repeat'), null);
    assert.equal(parseVoiceCommand('say again'), 'repeat');
  });

  it('still matches short utterances', () => {
    assert.equal(parseVoiceCommand('good'), 'good');
    assert.equal(parseVoiceCommand('easy'), 'easy');
    assert.equal(parseVoiceCommand('end session'), 'end');
  });

  it('fuzzy-matches close single-word commands', () => {
    assert.equal(parseVoiceCommand('god'), 'good');
  });

  it('maps rating commands through ratingFromCommand', () => {
    assert.equal(ratingFromCommand('good'), 'good');
    assert.equal(ratingFromCommand('flip'), null);
    assert.equal(ratingFromCommand('end'), null);
  });
});
