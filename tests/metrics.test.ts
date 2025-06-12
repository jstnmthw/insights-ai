import { median, getScoreColor } from '../src/utils/metrics.js';

describe('metrics utils', () => {
  test('median calculates correctly for odd length', () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  test('median calculates correctly for even length', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  test('getScoreColor returns green for ≥90', () => {
    expect(getScoreColor(95)).toBe('green');
  });
}); 