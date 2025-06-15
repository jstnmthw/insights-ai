import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock setTimeout globally before any imports to ensure retry logic runs instantly
const originalSetTimeout = globalThis.setTimeout;
const instantTimeout = ((cb: (...args: any[]) => void) => {
  cb();
  return 0 as unknown as ReturnType<typeof setTimeout>;
}) as typeof setTimeout;
Object.assign(instantTimeout, { __promisify__: (originalSetTimeout as any).__promisify__ });
globalThis.setTimeout = instantTimeout;

import axios from 'axios';

import { runPsi } from '../../src/services/psiService.js';
import { ApiError } from '../../src/errors/index.js';
import * as logService from '../../src/services/logService.js';

vi.mock('axios');
vi.mock('../../src/services/logService.js');

const mockedAxios = vi.mocked(axios);
const mockedLogService = vi.mocked(logService);

const mockApiResponse = (score = 0.95) => ({
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
});

describe('runPsi', () => {
  const url = 'https://example.com';
  const key = 'test-key';
  const strategy = 'desktop';
  const runNumber = 1;
  const filename = 'test.json';

  beforeEach(() => {
    vi.resetAllMocks();
    mockedLogService.getReportFilename.mockReturnValue(filename);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('development mode', () => {
    beforeEach(() => {
      vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', '/path/to/tsx', 'src/cli.ts']);
    });

    it('should return a cached report if available in dev mode', async () => {
      const cachedData = mockApiResponse(0.88);
      mockedLogService.readRawReport.mockReturnValue(cachedData as any);

      const result = await runPsi(url, key, strategy, runNumber);

      expect(mockedLogService.getReportFilename).toHaveBeenCalledWith(url, strategy);
      expect(mockedLogService.readRawReport).toHaveBeenCalledWith(filename);
      expect(console.log).toHaveBeenCalledWith('[DEV] Existing Report: Found');
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(result.score).toBe(88);
    });

    it('should fetch from API and save report if not cached in dev mode', async () => {
      const apiData = mockApiResponse(0.92);
      mockedLogService.readRawReport.mockReturnValue(null);
      vi.mocked(axios.get).mockResolvedValue({ data: apiData });

      const result = await runPsi(url, key, strategy, runNumber);

      expect(console.log).toHaveBeenCalledWith('[DEV] Existing Report: Missing');
      expect(mockedLogService.readRawReport).toHaveBeenCalledWith(filename);
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(mockedLogService.saveRawReport).toHaveBeenCalledWith(filename, apiData);
      expect(result.score).toBe(92);
    });

    it('should correctly parse the API response in dev mode', async () => {
      const apiData = mockApiResponse(0.75);
      mockedLogService.readRawReport.mockReturnValue(null);
      vi.mocked(axios.get).mockResolvedValue({ data: apiData });

      const result = await runPsi(url, key, strategy, runNumber);

      expect(result).toMatchObject({
        url,
        strategy,
        runNumber,
        score: 75,
        lcp: { display: '2.0 s', numeric: 2000 },
        fcp: { display: '1.0 s', numeric: 1000 },
        cls: { display: '0.05', numeric: 0.05 },
        tbt: { display: '150 ms', numeric: 150 },
      });
    });

    it('should throw ApiError if API fails in dev mode when no cache exists', async () => {
      mockedLogService.readRawReport.mockReturnValue(null);
      vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));

      await expect(runPsi(url, key, strategy, runNumber)).rejects.toThrow(ApiError);
    });

    it('should run in dev mode when NODE_ENV is development', async () => {
      vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', '/path/to/dist/cli.js']); // production path
      process.env.NODE_ENV = 'development';

      const cachedData = mockApiResponse(0.88);
      mockedLogService.readRawReport.mockReturnValue(cachedData as any);

      await runPsi(url, key, strategy, runNumber);

      expect(mockedLogService.readRawReport).toHaveBeenCalledWith(filename);
      expect(console.log).toHaveBeenCalledWith('[DEV] Existing Report: Found');

      delete process.env.NODE_ENV; // Clean up
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', '/path/to/dist/cli.js']);
    });

    it('should always fetch fresh data in production mode', async () => {
      const apiData = mockApiResponse(0.85);
      vi.mocked(axios.get).mockResolvedValue({ data: apiData });

      const result = await runPsi(url, key, strategy, runNumber);

      expect(mockedLogService.getReportFilename).not.toHaveBeenCalled();
      expect(mockedLogService.readRawReport).not.toHaveBeenCalled();
      expect(mockedLogService.saveRawReport).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('[DEV]'));
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(result.score).toBe(85);
    });

    it('should handle missing metrics and score in the API response', async () => {
      const partialApiData = {
        lighthouseResult: {
          categories: {
            performance: { score: null }, // Missing score
          },
          audits: {
            // Missing 'cumulative-layout-shift' and 'total-blocking-time'
            'largest-contentful-paint': { displayValue: '2.0 s', numericValue: 2000 },
            'first-contentful-paint': { displayValue: '1.0 s', numericValue: 1000 },
          },
        },
      };
      vi.mocked(axios.get).mockResolvedValue({ data: partialApiData as any });

      const result = await runPsi(url, key, strategy, runNumber);

      expect(result).toMatchObject({
        score: 0, // Should fallback to 0
        lcp: { display: '2.0 s', numeric: 2000 },
        fcp: { display: '1.0 s', numeric: 1000 },
        cls: { display: 'n/a', numeric: 0 }, // Should fallback
        tbt: { display: 'n/a', numeric: 0 }, // Should fallback
      });
    });

    it('should throw ApiError if API fails in production mode', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));

      await expect(runPsi(url, key, strategy, runNumber)).rejects.toThrow(ApiError);
      expect(mockedLogService.saveRawReport).not.toHaveBeenCalled();
    });

    describe('retry logic', () => {
      it('should retry failed API calls and succeed within max retries', async () => {
        const apiData = mockApiResponse(0.9);

        vi.mocked(axios.get).mockRejectedValueOnce(new Error('Flaky network'));
        vi.mocked(axios.get).mockResolvedValueOnce({ data: apiData });

        const promise = runPsi(url, key, strategy, runNumber);

        const result = await promise;

        expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2);
        expect(result.score).toBe(90);
      });

      it('should throw ApiError after exhausting all retries', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Persistent failure'));

        const promise = runPsi(url, key, strategy, runNumber);

        await expect(promise).rejects.toThrow(ApiError);

        expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(3);
      });
    });
  });
});

afterAll(() => {
  globalThis.setTimeout = originalSetTimeout;
}); 