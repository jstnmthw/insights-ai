import { AppConfig } from '../config/index.js';
import { MedianResult } from '../types/psi.js';

import { getScoreEmoji, getLcpEmoji, getFcpEmoji, getClsEmoji, getTbtEmoji } from './metrics.js';

/**
 * Format a metric numeric value for human readability.
 * Mirrors logic used in CLI display.
 */
export function formatMetric(value: number, unit: 'ms' | 's' = 'ms'): string {
  if (value === 0) return 'n/a';
  if (unit === 'ms') return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

/**
 * Build the Markdown report string that `cli.ts` writes to disk.
 * Extracted for testability.
 */
export function buildMarkdownReport(
  cfg: AppConfig,
  medianResults: MedianResult[],
  subheaderPlain: string,
  runInfo: string
): string {
  let mdContent = `# InsightsAI Analysis\n\n${subheaderPlain}\n${runInfo}\n\n`;
  mdContent += '## Legend\n\n';
  mdContent += '- 🟢 Good: Performance meets or exceeds recommended thresholds\n';
  mdContent +=
    '- 🟡 Needs Improvement: Performance is below recommended thresholds but not critical\n';
  mdContent += '- 🔴 Poor: Performance is significantly below recommended thresholds\n\n';

  mdContent += '## Final Results (Medians)\n\n';
  mdContent += '| URL | Strategy | Runs | Score | LCP | FCP | CLS | TBT |\n';
  mdContent += '| :-- | :------: | :--: | ----: | --: | --: | --: | --: |\n';
  medianResults.forEach((r) => {
    mdContent +=
      `| ${r.url} | ${r.strategy} | ${r.runs} | ${getScoreEmoji(r.medianScore)} ${r.medianScore} | ` +
      `${getLcpEmoji(r.medianLcp)} ${formatMetric(r.medianLcp)} | ` +
      `${getFcpEmoji(r.medianFcp)} ${formatMetric(r.medianFcp)} | ` +
      `${getClsEmoji(r.medianCls)} ${r.medianCls.toFixed(3)} | ` +
      `${getTbtEmoji(r.medianTbt)} ${formatMetric(r.medianTbt)} |\n`;
  });

  return mdContent;
}

export function appendAiSummary(mdContent: string, summarySection: string): string {
  if (!summarySection.trim()) return mdContent;
  return `${mdContent}\n\n## AI Summary\n\n${summarySection}\n`;
}
