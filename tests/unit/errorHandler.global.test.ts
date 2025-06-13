import { describe, it, expect, vi, beforeEach } from 'vitest';

import { setupGlobalHandlers } from '../../src/utils/errorHandler.js';
import { AppError } from '../../src/errors/index.js';

// Mock chalk to thin proxy
vi.mock('chalk', () => ({
  default: {
    red: (v: unknown) => v,
    yellow: (v: unknown) => v,
  },
}));

describe('utils/errorHandler.setupGlobalHandlers', () => {
  const listeners: Record<string, (arg: unknown) => void> = {};
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(process, 'on').mockImplementation((event: any, cb: any) => {
      listeners[event] = cb;
      return process as unknown as NodeJS.Process;
    });

    exitSpy = vi.spyOn(process as any, 'exit').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('registers global handlers and logs/ exits appropriately', () => {
    setupGlobalHandlers();

    // Simulate unhandledRejection with AppError
    const appErr = new AppError('boom');
    listeners['unhandledRejection'](appErr);

    // Simulate uncaughtException with generic Error
    const genericErr = new Error('oops');
    listeners['uncaughtException'](genericErr);

    // Two exit calls expected (one per handler)
    expect(exitSpy).toHaveBeenCalledTimes(2);
    // console.error called at least once
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
}); 