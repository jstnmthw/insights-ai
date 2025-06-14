import pLimit from 'p-limit';

import { loadConfig } from './config/index.js';
import { runPsi } from './services/psiService.js';
import { MedianResult, RunResult } from './types/psi.js';
import { median } from './utils/metrics.js';

export async function executeRuns(
  onProgress?: (completed: number, total: number) => void
): Promise<MedianResult[]> {
  const cfg = loadConfig();
  const limit = pLimit(cfg.concurrency);

  const jobs: Array<Promise<RunResult>> = [];
  const total = cfg.urls.length * cfg.strategies.length * cfg.runsPerUrl;
  let completed = 0;

  for (const url of cfg.urls) {
    for (const strategy of cfg.strategies as Array<'desktop' | 'mobile'>) {
      for (let run = 1; run <= cfg.runsPerUrl; run++) {
        jobs.push(
          limit(async () => {
            const res = await runPsi(url, cfg.apiKey, strategy, run);
            completed += 1;
            onProgress?.(completed, total);
            return res;
          })
        );
      }
    }
  }

  const allResults = await Promise.all(jobs);

  // Group results by URL + strategy
  const grouped = new Map<string, RunResult[]>();
  for (const res of allResults) {
    const key = `${res.url}|${res.strategy}`;
    const arr = grouped.get(key) ?? [];
    arr.push(res);
    grouped.set(key, arr);
  }

  const medians: MedianResult[] = [];
  for (const [key, runs] of grouped) {
    const [url, strategy] = key.split('|');
    const scores = runs.map((r) => r.score);
    const lcps = runs.map((r) => r.lcp.numeric);
    const fcps = runs.map((r) => r.fcp.numeric);
    const clss = runs.map((r) => r.cls.numeric);
    const tbts = runs.map((r) => r.tbt.numeric);
    const medianIndex = Math.floor(runs.length / 2);
    const sortedRuns = [...runs].sort((a, b) => a.score - b.score);
    const medianRun = sortedRuns[medianIndex];

    medians.push({
      url,
      strategy,
      runs: runs.length,
      medianScore: Math.round(median(scores)),
      medianLcp: median(lcps),
      medianFcp: median(fcps),
      medianCls: median(clss),
      medianTbt: median(tbts),
      individualRuns: runs,
      auditData: medianRun.auditData,
    });
  }

  return medians;
}
