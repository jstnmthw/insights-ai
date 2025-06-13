import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { logError } from '../../src/utils/errorHandler.js';
import { AppError } from '../../src/errors/index.js';

// Stub chalk for deterministic output
vi.mock('chalk', () => ({
  default: {
    red: (msg: unknown) => `red(${msg})`,
    yellow: (msg: unknown) => `yellow(${msg})`,
  },
}));

describe('utils/errorHandler.logError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs formatted message for AppError with details', () => {
    const err = new AppError('Something went wrong', { foo: 'bar' });
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ AppError: Something went wrong)');
    // details should be logged in yellow JSON string
    expect(
      consoleErrorSpy.mock.calls.some((c) => typeof c[0] === 'string' && c[0].startsWith('yellow('))
    ).toBe(true);
  });

  it('logs formatted message for generic Error', () => {
    const err = new Error('Generic error');
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ Generic error)');
  });

  it('handles unknown error values gracefully', () => {
    logError('string-error');

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ Unknown error:)', 'string-error');
  });
}); 