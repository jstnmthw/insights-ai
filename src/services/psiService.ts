import axios from 'axios';
import { Metric, RunResult } from '../types/psi.js';
import { ApiError } from '../errors/index.js';

function extractMetric(audits: any, id: string): Metric {
  return {
    display: audits[id]?.displayValue ?? 'n/a',
    numeric: audits[id]?.numericValue ?? 0,
  };
}

export async function runPsi(
  url: string,
  apiKey: string,
  strategy: 'desktop' | 'mobile',
  runNumber: number,
): Promise<RunResult> {
  let data: any;
  try {
    const resp = await axios.get('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed', {
      params: { url, strategy, key: apiKey },
    });
    data = resp.data;
  } catch (err) {
    throw new ApiError('Failed to fetch PageSpeed Insights data', err);
  }

  const lh = data.lighthouseResult;
  const core = lh.audits;

  return {
    url,
    strategy,
    runNumber,
    score: Math.round(lh.categories.performance.score * 100),
    lcp: extractMetric(core, 'largest-contentful-paint'),
    fcp: extractMetric(core, 'first-contentful-paint'),
    cls: extractMetric(core, 'cumulative-layout-shift'),
    tbt: extractMetric(core, 'total-blocking-time'),
  };
} 