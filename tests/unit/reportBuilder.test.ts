import { describe, it, expect } from 'vitest';

import { buildMarkdownReport, appendAiSummary, formatMetric } from '../../src/utils/reportBuilder.js';
import { AppConfig } from '../../src/config/index.js';
import { MedianResult, ComprehensivePsiData } from '../../src/types/psi.js';

const cfg: AppConfig = {
  apiKey: 'dummy',
  urls: ['https://example.com'],
  strategies: ['desktop'],
  concurrency: 1,
  runsPerUrl: 1,
  cfgPath: 'urls.yml',
  detailedReport: false,
  ai: { enabled: false, model: 'gpt-3.5-turbo' },
};

// Mock audit data for testing
const mockAuditData: ComprehensivePsiData = {
  url: 'https://example.com',
  strategy: 'desktop',
  performanceScore: 90,
  metrics: {
    lcp: 2000,
    fcp: 1000,
    cls: 0.05,
    tbt: 100,
    si: 1500,
  },
  opportunities: [],
  diagnostics: [],
  passedAudits: [],
  lighthouseVersion: '10.0.0',
  fetchTime: '2025-01-01T00:00:00.000Z',
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
    auditData: mockAuditData,
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

  it('handles zero values correctly in formatMetric', () => {
    const zeroResults: MedianResult[] = [
      {
        url: 'https://example.com',
        strategy: 'desktop',
        runs: 1,
        medianScore: 0,
        medianLcp: 0,
        medianFcp: 0,
        medianCls: 0,
        medianTbt: 0,
        individualRuns: [],
        auditData: { ...mockAuditData, performanceScore: 0 },
      },
    ];

    const md = buildMarkdownReport(cfg, zeroResults, 'Testing with zeros', 'Started at TEST_DATE');

    // Check that zero values are formatted as 'n/a' for LCP, FCP, and TBT metrics
    // CLS is handled differently with toFixed(3) so it shows as 0.000
    expect(md).toContain('n/a');
    expect(md).toContain('0.000');
    
    // Specifically test that LCP, FCP, and TBT show 'n/a' when zero
    const lines = md.split('\n');
    const dataLine = lines.find(line => line.includes('https://example.com'));
    expect(dataLine).toBeDefined();
    expect(dataLine).toMatch(/n\/a.*n\/a.*0\.000.*n\/a/); // LCP n/a, FCP n/a, CLS 0.000, TBT n/a
  });
});

describe('utils/reportBuilder.formatMetric', () => {
  it('returns "n/a" for zero values', () => {
    expect(formatMetric(0)).toBe('n/a');
    expect(formatMetric(0, 'ms')).toBe('n/a');
    expect(formatMetric(0, 's')).toBe('n/a');
  });

  it('formats milliseconds correctly', () => {
    expect(formatMetric(1500)).toBe('1500 ms');
    expect(formatMetric(1500, 'ms')).toBe('1500 ms');
    expect(formatMetric(2345.67)).toBe('2346 ms'); // rounds
  });

  it('formats seconds correctly', () => {
    expect(formatMetric(1500, 's')).toBe('1.5 s');
    expect(formatMetric(2345, 's')).toBe('2.3 s');
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