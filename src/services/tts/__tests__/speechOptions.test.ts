import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpeechOptions } from '../speechOptions';

describe('buildSpeechOptions', () => {
  it('maps volumePercent 60 to volume 0.6 with pitch 1.0 and unchanged rate 1.0', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 1.0,
      volumePercent: 60,
    });
    assert.equal(options.volume, 0.6);
    assert.equal(options.pitch, 1.0);
    assert.equal(options.rate, 1.0);
    assert.equal(options.language, 'en-US');
  });

  it('maps volumePercent 100 to volume 1.0 with pitch still 1.0', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 1.0,
      volumePercent: 100,
    });
    assert.equal(options.volume, 1.0);
    assert.equal(options.pitch, 1.0);
    assert.equal(options.rate, 1.0);
  });

  it('maps volumePercent 0 to volume 0', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 1.0,
      volumePercent: 0,
    });
    assert.equal(options.volume, 0);
    assert.equal(options.pitch, 1.0);
  });

  it('clamps volumePercent 150 to volume 1.0', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 1.0,
      volumePercent: 150,
    });
    assert.equal(options.volume, 1.0);
  });

  it('clamps volumePercent -20 to volume 0', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 1.0,
      volumePercent: -20,
    });
    assert.equal(options.volume, 0);
  });

  it('keeps rate 1.0 unchanged', () => {
    const options = buildSpeechOptions({
      locale: 'es-MX',
      rate: 1.0,
      volumePercent: 60,
    });
    assert.equal(options.rate, 1.0);
  });

  it('clamps rate 2.0 to 1.5', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 2.0,
      volumePercent: 60,
    });
    assert.equal(options.rate, 1.5);
  });

  it('clamps rate 0.1 to 0.5', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      rate: 0.1,
      volumePercent: 60,
    });
    assert.equal(options.rate, 0.5);
  });

  it('includes voice when a valid identifier is supplied', () => {
    const options = buildSpeechOptions({
      locale: 'en-US',
      voiceIdentifier: 'com.apple.voice.enhanced.en-US.Samantha',
      rate: 1.0,
      volumePercent: 60,
    });
    assert.equal(options.voice, 'com.apple.voice.enhanced.en-US.Samantha');
  });

  it('omits voice when identifier is null, undefined, or empty', () => {
    for (const voiceIdentifier of [null, undefined, ''] as const) {
      const options = buildSpeechOptions({
        locale: 'en-US',
        voiceIdentifier,
        rate: 1.0,
        volumePercent: 60,
      });
      assert.equal('voice' in options, false);
    }
  });

  it('never lets volume modify pitch', () => {
    for (const volumePercent of [0, 60, 100, 150]) {
      const options = buildSpeechOptions({
        locale: 'en-US',
        rate: 1.0,
        volumePercent,
      });
      assert.equal(options.pitch, 1.0);
    }
  });

  it('never lets volume modify rate', () => {
    const rates = [0.5, 1.0, 1.25];
    for (const rate of rates) {
      for (const volumePercent of [0, 60, 100]) {
        const options = buildSpeechOptions({
          locale: 'en-US',
          rate,
          volumePercent,
        });
        assert.equal(options.rate, rate);
      }
    }
  });
});
