import { describe, it, expect } from 'vitest';

import { buildMarkdownReport, appendAiSummary } from '../../src/utils/reportBuilder.js';
import { AppConfig } from '../../src/config/index.js';
import { MedianResult } from '../../src/types/psi.js';

const cfg: AppConfig = {
  apiKey: 'dummy',
  urls: ['https://example.com'],
  strategies: ['desktop'],
  concurrency: 1,
  runsPerUrl: 1,
  cfgPath: 'urls.yml',
  ai: { enabled: false, model: 'gpt-3.5-turbo' },
};

const medianResults: MedianResult[] = [
  {
    url: 'https://example.com',
    strategy: 'desktop',
    runs: 1,
    medianScore: 90,
    medianLcp: 2000,
    medianFcp: 1000,
    medianCls: 0.05,
    medianTbt: 100,
    individualRuns: [],
  },
];

describe('utils/reportBuilder.buildMarkdownReport', () => {
  it('returns correctly formatted markdown', () => {
    const md = buildMarkdownReport(cfg, medianResults, 'Testing 1 URL × 1 strategy × 1 run', 'Started at TEST_DATE');

    expect(md).toMatchInlineSnapshot(`
"# InsightsAI Analysis

Testing 1 URL × 1 strategy × 1 run
Started at TEST_DATE

## Legend

- 🟢 Good: Performance meets or exceeds recommended thresholds
- 🟡 Needs Improvement: Performance is below recommended thresholds but not critical
- 🔴 Poor: Performance is significantly below recommended thresholds

## Final Results (Medians)

| URL | Strategy | Runs | Score | LCP | FCP | CLS | TBT |
| :-- | :------: | :--: | ----: | --: | --: | --: | --: |
| https://example.com | desktop | 1 | 🟢 90 | 🟢 2000 ms | 🟢 1000 ms | 🟢 0.050 | 🟢 100 ms |
"
    `);
  });
});

describe('utils/reportBuilder.appendAiSummary', () => {
  it('appendAiSummary returns original content when summarySection is empty', () => {
    const original = '# Report';
    const result = appendAiSummary(original, '   ');
    expect(result).toBe(original);
  });

  it('appendAiSummary appends formatted summary when non-empty', () => {
    const original = '# Report';
    const summary = '**Overview**: Good';
    const expected = `${original}\n\n## AI Summary\n\n${summary}\n`;
    const result = appendAiSummary(original, summary);
    expect(result).toBe(expected);
  });
}); 