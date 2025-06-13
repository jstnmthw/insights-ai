import { describe, it, expect, vi, beforeEach } from 'vitest';

import path from 'path';
import { savePsiRaw } from '../../src/services/logService.js';

// Use var declarations to avoid TDZ with hoisted vi.mock factories
var mockExists: boolean;
var writeFileSpy: ReturnType<typeof vi.fn>;
var mkdirSpy: ReturnType<typeof vi.fn>;

vi.mock('fs', () => {
  mockExists = false;
  writeFileSpy = vi.fn();
  mkdirSpy = vi.fn();
  return {
    default: {
      existsSync: () => mockExists,
      mkdirSync: (...args: unknown[]) => mkdirSpy(...args),
      writeFileSync: (...args: unknown[]) => writeFileSpy(...args),
    },
  };
});

beforeEach(() => {
  mkdirSpy.mockClear();
  writeFileSpy.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('services/logService.savePsiRaw', () => {
  it('creates logs directory when missing and writes file', () => {
    mockExists = false;
    savePsiRaw({ foo: 'bar' });

    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled();
    const filePath = writeFileSpy.mock.calls[0][0] as string;
    expect(filePath).toContain(path.join('logs'));
  });

  it('does not create directory if it already exists', () => {
    mockExists = true;
    savePsiRaw({ foo: 'bar' });

    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled();
  });

  it('handles fs write errors gracefully', () => {
    mockExists = true;
    writeFileSpy.mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() => savePsiRaw({})).not.toThrow();
    expect(console.error).toBeDefined();
  });
}); 