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
}); 