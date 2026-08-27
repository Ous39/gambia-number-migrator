import { describe, expect, it } from 'vitest';
import { isValidGambianLength, localDigitsFromInput } from './NumberChecker';

describe('localDigitsFromInput', () => {
  it('strips non-digit characters', () => {
    expect(localDigitsFromInput('363-1776')).toBe('3631776');
  });
  it('strips a leading 220 country code', () => {
    expect(localDigitsFromInput('+220 363 1776')).toBe('3631776');
    expect(localDigitsFromInput('220871234567')).toBe('871234567');
  });
  it('leaves a bare local number untouched', () => {
    expect(localDigitsFromInput('3631776')).toBe('3631776');
  });
});

describe('isValidGambianLength', () => {
  it('accepts 7-digit old format', () => { expect(isValidGambianLength('3631776')).toBe(true); });
  it('accepts 9-digit new format', () => { expect(isValidGambianLength('831234567')).toBe(true); });
  it('rejects other lengths', () => {
    expect(isValidGambianLength('')).toBe(false);
    expect(isValidGambianLength('12345')).toBe(false);
    expect(isValidGambianLength('12345678')).toBe(false);
    expect(isValidGambianLength('12345678901')).toBe(false);
  });
});
