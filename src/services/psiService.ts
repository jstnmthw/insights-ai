import axios from 'axios';

import { ApiError } from '../errors/index.js';
import type { Metric, RunResult, LighthouseAudits, PsiApiResponse } from '../types/psi.js';

import { auditExtractor } from './auditExtractor.js';
import { getReportFilename, readRawReport, saveRawReport } from './logService.js';

function extractMetric(audits: LighthouseAudits, id: string): Metric {
  return {
    display: audits[id]?.displayValue ?? 'n/a',
    numeric: audits[id]?.numericValue ?? 0,
  };
}

// Check if we're in development mode
function isDevelopmentMode(): boolean {
  // Check for common development indicators
  const hasDevIndicators = process.argv.some(
    (arg) => arg.includes('tsx') || arg.includes('ts-node') || arg.includes('src/cli.ts')
  );

  // Also check NODE_ENV
  const isNodeEnvDev = process.env.NODE_ENV === 'development';

  // Check if we're running from src/ directory (development) vs dist/ (production)
  const isRunningFromSrc = process.argv.some((arg) => arg.includes('src/'));

  return hasDevIndicators || isNodeEnvDev || isRunningFromSrc;
}

// Maximum number of times to retry a failed PSI API request.
const MAX_API_RETRIES = 3 as const;

/**
 * Fetches PageSpeed Insights data with retry logic.
 *
 * The PSI REST endpoint is occasionally flaky. To improve overall robustness
 * we retry the request up to `MAX_API_RETRIES` times using a simple
 * exponential back-off (1s, 2s, 3s …). If the request still fails after the
 * final attempt the original error is re-thrown to be handled upstream.
 *
 * @param url - The URL to analyse
 * @param apiKey - Google PageSpeed Insights API key
 * @param strategy - Either "desktop" or "mobile"
 * @throws Error from `axios` after exhausting all retries
 */
async function fetchPsiDataWithRetry(
  url: string,
  apiKey: string,
  strategy: 'desktop' | 'mobile'
): Promise<PsiApiResponse> {
  let attempt = 0;

  while (true) {
    try {
      const resp = await axios.get<PsiApiResponse>(
        'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed',
        {
          params: { url, strategy, key: apiKey },
        }
      );
      return resp.data;
    } catch (err) {
      attempt += 1;

      // If we've exceeded our retry budget surface the error to the caller.
      if (attempt >= MAX_API_RETRIES) {
        throw err;
      }

      // Wait `attempt * 500ms` before the next retry – fast enough for tests while still spacing requests.
      await new Promise((resolve) => globalThis.setTimeout(resolve, attempt * 500));
    }
  }
}

export async function runPsi(
  url: string,
  apiKey: string,
  strategy: 'desktop' | 'mobile',
  runNumber: number
): Promise<RunResult> {
  let data: PsiApiResponse;

  const isDevMode = isDevelopmentMode();

  if (isDevMode) {
    const filename = getReportFilename(url, strategy);
    const cachedReport = readRawReport(filename);

    if (cachedReport) {
      console.log('[DEV] Existing Report: Found');
      data = cachedReport;
    } else {
      console.log('[DEV] Existing Report: Missing');
      try {
        data = await fetchPsiDataWithRetry(url, apiKey, strategy);

        console.log(`[DEV] Saving raw report to: ${filename}`);
        saveRawReport(filename, data);
        console.log(`[DEV] Raw report saved successfully`);
      } catch (err) {
        throw new ApiError('Failed to fetch PageSpeed Insights data', err);
      }
    }
  } else {
    // Production mode: always fetch fresh data, no caching
    try {
      data = await fetchPsiDataWithRetry(url, apiKey, strategy);
    } catch (err) {
      throw new ApiError('Failed to fetch PageSpeed Insights data', err);
    }
  }

  const lh = data.lighthouseResult;
  const core = lh.audits;

  // Extract comprehensive audit data
  const auditData = auditExtractor.extractComprehensiveData(lh, url, strategy);

  return {
    url,
    strategy,
    runNumber,
    score: Math.round((lh.categories.performance.score ?? 0) * 100),
    lcp: extractMetric(core, 'largest-contentful-paint'),
    fcp: extractMetric(core, 'first-contentful-paint'),
    cls: extractMetric(core, 'cumulative-layout-shift'),
    tbt: extractMetric(core, 'total-blocking-time'),
    auditData,
  };
}
