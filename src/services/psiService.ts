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
        const resp = await axios.get<PsiApiResponse>(
          'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed',
          {
            params: { url, strategy, key: apiKey },
          }
        );
        data = resp.data;

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
      const resp = await axios.get<PsiApiResponse>(
        'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed',
        {
          params: { url, strategy, key: apiKey },
        }
      );
      data = resp.data;
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
