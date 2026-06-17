import { describe, it, expect } from 'node:test';
import { parseVoiceCommand } from '../commandParser';

describe('commandParser', () => {
  it('parses flip command', () => {
    expect(parseVoiceCommand('flip')).toBe('flip');
    expect(parseVoiceCommand('show answer')).toBe('flip');
  });

  it('parses rating commands', () => {
    expect(parseVoiceCommand('good')).toBe('good');
    expect(parseVoiceCommand('that was easy')).toBe('easy');
    expect(parseVoiceCommand('again')).toBe('again');
  });

  it('parses session commands', () => {
    expect(parseVoiceCommand('pause')).toBe('pause');
    expect(parseVoiceCommand('end session')).toBe('end');
  });

  it('returns null for unrecognized input', () => {
    expect(parseVoiceCommand('hello world')).toBeNull();
  });
});
