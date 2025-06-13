import { describe, it, expect, vi, beforeEach } from 'vitest';

import { runPsi } from '../../src/services/psiService.js';
import { ApiError } from '../../src/errors/index.js';

// Declare spies with var for hoist safety
var savePsiRawSpy: ReturnType<typeof vi.fn>;
vi.mock('../../src/services/logService.js', () => {
  savePsiRawSpy = vi.fn();
  return { savePsiRaw: savePsiRawSpy };
});

var getSpy: ReturnType<typeof vi.fn>;
vi.mock('axios', () => {
  getSpy = vi.fn();
  return { default: { get: getSpy } };
});

// Sample API response
function mockApiResponse(score: number = 0.95) {
  return {
    lighthouseResult: {
      categories: {
        performance: { score },
      },
      audits: {
        'largest-contentful-paint': { displayValue: '2.0 s', numericValue: 2000 },
        'first-contentful-paint': { displayValue: '1.0 s', numericValue: 1000 },
        'cumulative-layout-shift': { displayValue: '0.05', numericValue: 0.05 },
        'total-blocking-time': { displayValue: '150 ms', numericValue: 150 },
      },
    },
  };
}

beforeEach(() => {
  savePsiRawSpy.mockClear();
  getSpy.mockReset();
});

describe('services/psiService.runPsi', () => {
  it('returns parsed metrics and calls savePsiRaw', async () => {
    getSpy.mockResolvedValue({ data: mockApiResponse(0.9) });

    const result = await runPsi('https://example.com', 'dummy-key', 'mobile', 1);

    expect(result).toMatchObject({
      url: 'https://example.com',
      strategy: 'mobile',
      runNumber: 1,
      score: 90, // 0.9 * 100 rounded
    });

    expect(result.lcp).toEqual({ display: '2.0 s', numeric: 2000 });
    expect(result.fcp).toEqual({ display: '1.0 s', numeric: 1000 });
    expect(result.cls).toEqual({ display: '0.05', numeric: 0.05 });
    expect(result.tbt).toEqual({ display: '150 ms', numeric: 150 });
    expect(savePsiRawSpy).toHaveBeenCalled();
  });

  it('throws ApiError when axios request fails', async () => {
    getSpy.mockRejectedValue(new Error('network error'));

    await expect(
      runPsi('https://example.com', 'dummy', 'desktop', 1)
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('returns default display/numeric when audit missing', async () => {
    getSpy.mockResolvedValue({
      data: {
        lighthouseResult: {
          categories: { performance: { score: 0.8 } },
          audits: {},
        },
      },
    });

    const res = await runPsi('https://example.com', 'k', 'desktop', 1);

    expect(res.lcp).toEqual({ display: 'n/a', numeric: 0 });
  });
}); 