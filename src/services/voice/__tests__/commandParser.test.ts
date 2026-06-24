import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../commandParser';

describe('commandParser', () => {
  it('parses flip command', () => {
    assert.equal(parseVoiceCommand('flip'), 'flip');
    assert.equal(parseVoiceCommand('show answer'), 'flip');
  });

  it('parses rating commands', () => {
    assert.equal(parseVoiceCommand('good'), 'good');
    assert.equal(parseVoiceCommand('that was easy'), 'easy');
    assert.equal(parseVoiceCommand('again'), 'again');
  });

  it('parses session commands', () => {
    assert.equal(parseVoiceCommand('pause'), 'pause');
    assert.equal(parseVoiceCommand('end session'), 'end');
  });

  it('returns null for unrecognized input', () => {
    assert.equal(parseVoiceCommand('hello world'), null);
  });
});
