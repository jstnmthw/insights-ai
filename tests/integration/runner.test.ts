import { describe, it, expect, vi } from 'vitest';

import { executeRuns } from '../../src/runner.js';
import { MedianResult } from '../../src/types/psi.js';

// Mock configuration loader
vi.mock('../../src/config/index.js', () => ({
  loadConfig: () => ({
    apiKey: 'dummy',
    urls: ['https://a.com'],
    strategies: ['desktop'],
    concurrency: 2,
    runsPerUrl: 3,
    cfgPath: 'urls.yml',
    ai: { enabled: false, model: 'gpt-3.5-turbo' },
  }),
}));

// Mock cli-progress
vi.mock('cli-progress', () => {
  class Bar {
    start() {}
    update() {}
    stop() {}
  }
  return { SingleBar: Bar };
});

// Mock runPsi to return deterministic results
vi.mock('../../src/services/psiService.js', () => {
  const runResults = [
    { score: 80, lcp: { numeric: 2000, display: '2s' } },
    { score: 90, lcp: { numeric: 2500, display: '2.5s' } },
    { score: 100, lcp: { numeric: 3000, display: '3s' } },
  ];

  return {
    runPsi: vi.fn(async (_url: string, _key: string, _strategy: string, run: number) => ({
      url: 'https://a.com',
      strategy: 'desktop',
      runNumber: run,
      score: runResults[run - 1].score,
      lcp: runResults[run - 1].lcp,
      fcp: { numeric: 1000 * run, display: `${run}s` },
      cls: { numeric: 0.1 * run, display: `${0.1 * run}` },
      tbt: { numeric: 50 * run, display: `${50 * run}ms` },
    })),
  };
});

describe('integration/executeRuns', () => {
  it('executes runs and computes medians', async () => {
    const progressCalls: number[] = [];

    const results: MedianResult[] = await executeRuns((completed) => {
      progressCalls.push(completed);
    });

    expect(results).toHaveLength(1);
    const median = results[0];

    expect(median.url).toBe('https://a.com');
    expect(median.strategy).toBe('desktop');
    expect(median.runs).toBe(3);

    expect(median.medianScore).toBe(90); // median of [80,90,100]

    expect(progressCalls).toEqual([1, 2, 3]);
  });
});
