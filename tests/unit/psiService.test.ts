import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    // Mock console.log to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('development mode', () => {
    beforeEach(() => {
      // Mock development mode by setting tsx in argv
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
  });

  describe('production mode', () => {
    beforeEach(() => {
      // Mock production mode by setting node in argv
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

    it('should throw ApiError if API fails in production mode', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));

      await expect(runPsi(url, key, strategy, runNumber)).rejects.toThrow(ApiError);
      expect(mockedLogService.saveRawReport).not.toHaveBeenCalled();
    });
  });
}); 