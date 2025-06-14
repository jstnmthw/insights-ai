import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock third-party UI libraries to no-ops for fast testing
vi.mock('chalk', () => {
  const colorFn = (val: unknown) => String(val);
  const chainable = new Proxy(colorFn, {
    get: () => chainable,
  });
  const chalkMock = new Proxy({}, {
    get: () => chainable,
  });
  return { default: chalkMock };
});
vi.mock('gradient-string', () => ({
  default: () => (str: string) => str,
}));

vi.mock('cli-progress', () => {
  class Bar {
    start() {}
    update() {}
    stop() {}
    bold() {}
  }
  return { default: { SingleBar: Bar } };
});

vi.mock('cli-table3', () => ({ default: class { push() {}; toString() { return ''; } } }));

// Mock fs to avoid actual file writes
vi.mock('fs', () => ({
  default: {
    existsSync: () => true,
    mkdirSync: () => {},
    writeFileSync: () => {},
  },
}));

// Mock configuration and runner
const dummyConfig = {
  apiKey: 'dummy',
  urls: ['https://example.com'],
  strategies: ['desktop'],
  concurrency: 1,
  runsPerUrl: 1,
  cfgPath: 'urls.yml',
  ai: { enabled: false, model: 'gpt-3.5-turbo' },
};

vi.mock('../../src/config/index.js', () => ({
  loadConfig: () => dummyConfig,
}));

vi.mock('../../src/runner.js', () => ({
  executeRuns: vi.fn(async (onProgress: (n: number) => void) => {
    onProgress(1);
    return [
      {
        url: 'https://example.com',
        strategy: 'desktop',
        runs: 1,
        medianScore: 95,
        medianLcp: 2000,
        medianFcp: 1000,
        medianCls: 0.05,
        medianTbt: 100,
        individualRuns: [],
      },
    ];
  }),
}));

// Replace process.exit spy to just record calls without throwing
const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

beforeAll(() => {
  process.env.PSI_KEY = 'dummy';
});

// Silence console output and direct writes during the test to keep runner output clean
const noop = () => {};
vi.spyOn(console, 'log').mockImplementation(noop);
vi.spyOn(console, 'clear').mockImplementation(noop as any);
vi.spyOn(console, 'error').mockImplementation(noop);
vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

describe('CLI main function', async () => {
  it('runs successfully and does not call process.exit', async () => {
    // Dynamically import CLI after mocks are in place
    const { main } = await import('../../src/cli.js');

    await expect(main()).resolves.not.toThrow();

    expect(exitSpy).not.toHaveBeenCalled();
  });
}); 