import { describe, it, expect } from 'vitest';
import { median, getScoreColor, getLcpColor } from '../src/utils/metrics.js';

describe('metrics utils', () => {
  it('median calculates correctly for odd length', () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  it('median calculates correctly for even length', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('getScoreColor returns green for ≥90', () => {
    expect(getScoreColor(95)).toBe('green');
  });

  it('getLcpColor returns green for ≤2500', () => {
    expect(getLcpColor(2000)).toBe('green');
  });
}); 