import { describe, expect, it } from 'vitest';
import { formatMinor, minorToDecimalString, toMinorUnits } from '@lms/shared';

describe('money helpers', () => {
  describe('toMinorUnits', () => {
    it('converts decimal strings to integer minor units without floating point drift', () => {
      expect(toMinorUnits('0.01')).toBe(1);
      expect(toMinorUnits('1234.50')).toBe(123_450);
      expect(toMinorUnits('19.99')).toBe(1999);
      expect(toMinorUnits('1000')).toBe(100_000);
      expect(toMinorUnits(250.75)).toBe(25_075);
    });

    it('rounds half up on the third decimal place', () => {
      expect(toMinorUnits('10.004')).toBe(1000);
      expect(toMinorUnits('10.005')).toBe(1001);
      expect(toMinorUnits('0.009')).toBe(1);
    });

    it('rejects values that are not plain positive decimals', () => {
      expect(toMinorUnits('')).toBeNull();
      expect(toMinorUnits('12,00')).toBeNull();
      expect(toMinorUnits('-5.00')).toBeNull();
      expect(toMinorUnits('abc')).toBeNull();
      expect(toMinorUnits('1.2.3')).toBeNull();
    });
  });

  describe('minorToDecimalString', () => {
    it('renders exact two-decimal values', () => {
      expect(minorToDecimalString(5)).toBe('0.05');
      expect(minorToDecimalString(12_345)).toBe('123.45');
      expect(minorToDecimalString(-7)).toBe('-0.07');
      expect(minorToDecimalString(0)).toBe('0.00');
    });
  });

  describe('formatMinor', () => {
    it('formats minor units for display', () => {
      expect(formatMinor(123_456)).toContain('1,234.56');
      expect(formatMinor(-123_456)).toContain('-');
      expect(formatMinor(0)).toContain('0.00');
    });

    it('tolerates invalid values instead of throwing', () => {
      expect(formatMinor(Number.NaN)).toContain('0.00');
    });
  });
});
