import { describe, it, expect, vi } from 'vitest';
import {
  median,
  getScoreColor,
  getLcpColor,
  getFcpColor,
  getClsColor,
  getTbtColor,
  getScoreEmoji,
  getLcpEmoji,
  getFcpEmoji,
  getClsEmoji,
  getTbtEmoji,
  colorize,
  formatHumanTime,
} from '../../src/utils/metrics.js';

// Mock chalk so we can assert colorize output deterministically
vi.mock('chalk', () => ({
  default: {
    green: (val: unknown) => `green(${val})`,
    yellow: (val: unknown) => `yellow(${val})`,
    red: (val: unknown) => `red(${val})`,
  },
}));

describe('utils/metrics', () => {
  describe('median', () => {
    it('calculates median for odd length array', () => {
      expect(median([5, 1, 3])).toBe(3);
    });

    it('calculates median for even length array', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
  });

  describe('color helpers', () => {
    it.each([
      [getScoreColor, 95, 'green'],
      [getScoreColor, 75, 'yellow'],
      [getScoreColor, 20, 'red'],
      [getLcpColor, 2400, 'green'],
      [getLcpColor, 3000, 'yellow'],
      [getLcpColor, 5000, 'red'],
      [getFcpColor, 1500, 'green'],
      [getFcpColor, 2000, 'yellow'],
      [getFcpColor, 4000, 'red'],
      [getClsColor, 0.05, 'green'],
      [getClsColor, 0.2, 'yellow'],
      [getClsColor, 0.3, 'red'],
      [getTbtColor, 100, 'green'],
      [getTbtColor, 400, 'yellow'],
      [getTbtColor, 650, 'red'],
    ])('%p(%p) -> %p', (fn, input, expected) => {
      expect(fn(input as number)).toBe(expected);
    });
  });

  describe('emoji helpers', () => {
    it.each([
      [getScoreEmoji, 95, '🟢'],
      [getScoreEmoji, 70, '🟡'],
      [getScoreEmoji, 40, '🔴'],
      [getLcpEmoji, 2400, '🟢'],
      [getLcpEmoji, 3000, '🟡'],
      [getLcpEmoji, 5000, '🔴'],
      [getFcpEmoji, 1500, '🟢'],
      [getFcpEmoji, 2500, '🟡'],
      [getFcpEmoji, 4000, '🔴'],
      [getClsEmoji, 0.05, '🟢'],
      [getClsEmoji, 0.2, '🟡'],
      [getClsEmoji, 0.4, '🔴'],
      [getTbtEmoji, 150, '🟢'],
      [getTbtEmoji, 450, '🟡'],
      [getTbtEmoji, 700, '🔴'],
    ])('%p(%p) -> %p', (fn, input, expected) => {
      expect(fn(input as number)).toBe(expected);
    });
  });

  describe('colorize', () => {
    it('delegates to chalk with correct color', () => {
      expect(colorize('value', 'green')).toBe('green(value)');
      expect(colorize(123, 'yellow')).toBe('yellow(123)');
    });
  });

  describe('formatHumanTime', () => {
    it('handles zero values', () => {
      expect(formatHumanTime(0)).toBe('n/a');
    });

    it('formats milliseconds under 1 second', () => {
      expect(formatHumanTime(100)).toBe('100ms');
      expect(formatHumanTime(500)).toBe('500ms');
      expect(formatHumanTime(999)).toBe('999ms');
      expect(formatHumanTime(999.7)).toBe('1s'); // rounds up to 1000ms, converts to 1s
    });

    it('formats seconds (1s to under 1min)', () => {
      expect(formatHumanTime(1000)).toBe('1s');
      expect(formatHumanTime(1500)).toBe('1.5s');
      expect(formatHumanTime(2000)).toBe('2s');
      expect(formatHumanTime(2300)).toBe('2.3s');
      expect(formatHumanTime(59000)).toBe('59s');
      expect(formatHumanTime(59999)).toBe('60s'); // rounds to 60s
    });

    it('formats minutes (1min and above)', () => {
      expect(formatHumanTime(60000)).toBe('1min');
      expect(formatHumanTime(90000)).toBe('1.5min');
      expect(formatHumanTime(120000)).toBe('2min');
      expect(formatHumanTime(130000)).toBe('2.2min');
      expect(formatHumanTime(600000)).toBe('10min');
    });

    it('handles edge cases and rounding', () => {
      // Test floating point precision - should round to whole seconds
      expect(formatHumanTime(1000.4)).toBe('1s');
      expect(formatHumanTime(1000.6)).toBe('1s');
      expect(formatHumanTime(1499.4)).toBe('1.5s');
      expect(formatHumanTime(1500.6)).toBe('1.5s');
      
      // Test minute rounding
      expect(formatHumanTime(60000.4)).toBe('1min');
      expect(formatHumanTime(89999)).toBe('1.5min');
      expect(formatHumanTime(90001)).toBe('1.5min');
    });
  });
}); 