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

  it('logs AppError without details', () => {
    const err = new AppError('No details');
    err.stack = 'stack-trace';
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ AppError: No details)');
    // ensure details are NOT logged
    expect(
      consoleErrorSpy.mock.calls.some((c) => typeof c[0] === 'string' && c[0].startsWith('yellow('))
    ).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('stack-trace');
  });

  it('logs AppError without stack trace', () => {
    const err = new AppError('No stack');
    err.stack = undefined; // Ensure no stack trace
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ AppError: No stack)');
    // Should not log stack trace
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('logs formatted message for generic Error', () => {
    const err = new Error('Generic error');
    // Keep stack undefined for this test
    err.stack = undefined;
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ Generic error)');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('logs formatted message for generic Error with stack', () => {
    const err = new Error('Generic error');
    err.stack = 'error-stack';
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ Generic error)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('error-stack');
  });

  it('logs formatted message for generic Error without stack', () => {
    const err = new Error('No stack');
    err.stack = undefined; // Ensure stack is not present
    logError(err);

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ No stack)');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // Only message should be logged
  });

  it('handles unknown error values gracefully', () => {
    logError('string-error');

    expect(consoleErrorSpy).toHaveBeenCalledWith('red(❌ Unknown error:)', 'string-error');
  });
}); 