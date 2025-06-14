import { URL } from 'node:url';

import { AppConfig } from '../config/index.js';
import type { MedianResult, PsiAudit, PsiAuditItem } from '../types/psi.js';

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
 * Format bytes for human readability.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Build the basic Markdown report string that `cli.ts` writes to disk.
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

/**
 * Build a comprehensive Markdown report including detailed audit data.
 */
export function buildComprehensiveMarkdownReport(
  cfg: AppConfig,
  medianResults: MedianResult[],
  subheaderPlain: string,
  runInfo: string
): string {
  // Start with basic report
  let mdContent = buildMarkdownReport(cfg, medianResults, subheaderPlain, runInfo);

  // Add detailed audit sections for each result
  medianResults.forEach((result) => {
    mdContent += `\n\n## Detailed Analysis: ${result.url} (${result.strategy})\n\n`;
    mdContent += buildOpportunitiesSection(result.auditData.opportunities);
    mdContent += buildDiagnosticsSection(result.auditData.diagnostics);
    mdContent += buildPassedAuditsSection(result.auditData.passedAudits);
  });

  return mdContent;
}

/**
 * Build the opportunities section with specific files and savings.
 */
function buildOpportunitiesSection(opportunities: PsiAudit[]): string {
  if (opportunities.length === 0) {
    return '### 🟢 Performance Opportunities\n\nNo significant optimization opportunities identified.\n\n';
  }

  let section = '### ⚡ Performance Opportunities\n\n';

  opportunities.slice(0, 10).forEach((opp) => {
    section += `#### ${opp.title}\n`;
    section += `${opp.description}\n\n`;

    if (opp.displayValue) {
      section += `**Potential savings:** ${opp.displayValue}\n\n`;
    }

    if (opp.metricSavings) {
      const savings = Object.entries(opp.metricSavings)
        .map(([metric, value]) => `${metric}: ${value}ms`)
        .join(', ');
      section += `**Metric improvements:** ${savings}\n\n`;
    }

    if (opp.details?.items && opp.details.items.length > 0) {
      section += buildAuditItemsTable(opp.details.items, opp.id);
    }

    section += '\n---\n\n';
  });

  return section;
}

/**
 * Build the diagnostics section with specific elements and issues.
 */
function buildDiagnosticsSection(diagnostics: PsiAudit[]): string {
  if (diagnostics.length === 0) {
    return '### 🔍 Diagnostics\n\nNo significant diagnostic issues found.\n\n';
  }

  let section = '### 🔍 Diagnostics\n\n';

  diagnostics.slice(0, 8).forEach((diag) => {
    section += `#### ${diag.title}\n`;
    section += `${diag.description}\n\n`;

    if (diag.displayValue) {
      section += `**Value:** ${diag.displayValue}\n\n`;
    }

    if (diag.details?.items && diag.details.items.length > 0) {
      section += buildAuditItemsTable(diag.details.items, diag.id);
    }

    section += '\n---\n\n';
  });

  return section;
}

/**
 * Build a summary of passed audits.
 */
function buildPassedAuditsSection(passedAudits: PsiAudit[]): string {
  if (passedAudits.length === 0) return '';

  let section = '### ✅ Passed Audits\n\n';
  section += 'The following performance checks passed successfully:\n\n';

  passedAudits.slice(0, 10).forEach((audit) => {
    section += `- **${audit.title}**`;
    if (audit.displayValue) {
      section += ` (${audit.displayValue})`;
    }
    section += '\n';
  });

  return section + '\n';
}

/**
 * Build a table or list for audit items based on the audit type.
 */
function buildAuditItemsTable(items: PsiAuditItem[], _auditId: string): string {
  if (items.length === 0) return '';

  // Determine the best format based on the data available
  const hasUrls = items.some((item) => item.url);
  const hasNodes = items.some((item) => item.node);
  const hasBytes = items.some((item) => item.wastedBytes || item.totalBytes);
  const hasMs = items.some((item) => item.wastedMs);

  if (hasUrls && (hasBytes || hasMs)) {
    return buildResourceTable(items);
  } else if (hasNodes) {
    return buildElementList(items);
  } else {
    return buildSimpleList(items);
  }
}

/**
 * Build a table for resource-based items (files, scripts, styles).
 */
function buildResourceTable(items: PsiAuditItem[]): string {
  let table = '| Resource | Size | Potential Savings |\n';
  table += '| :-- | --: | --: |\n';

  items.slice(0, 10).forEach((item) => {
    const url = item.url
      ? (() => {
          try {
            return new URL(item.url).pathname;
          } catch {
            return item.url;
          }
        })()
      : 'Unknown resource';
    const size = item.totalBytes ? formatBytes(item.totalBytes) : 'n/a';
    const savings = item.wastedBytes
      ? formatBytes(item.wastedBytes)
      : item.wastedMs
        ? `${Math.round(item.wastedMs)}ms`
        : 'n/a';

    table += `| \`${url}\` | ${size} | ${savings} |\n`;
  });

  return table + '\n';
}

/**
 * Build a list for DOM element-based items.
 */
function buildElementList(items: PsiAuditItem[]): string {
  let list = '';

  items.slice(0, 10).forEach((item) => {
    if (item.node) {
      list += `- **Element:** \`${item.node.selector}\`\n`;
      if (item.node.snippet) {
        list += `  - **Code:** \`${item.node.snippet.substring(0, 100)}${item.node.snippet.length > 100 ? '...' : ''}\`\n`;
      }
      if (item.score !== undefined) {
        list += `  - **Impact:** ${item.score}\n`;
      }
    }
  });

  return list + '\n';
}

/**
 * Build a simple list for other item types.
 */
function buildSimpleList(items: PsiAuditItem[]): string {
  let list = '';

  items.slice(0, 10).forEach((item) => {
    if (item.label) {
      list += `- ${item.label}\n`;
    } else if (item.url) {
      list += `- ${item.url}\n`;
    }
  });

  return list + '\n';
}

export function appendAiSummary(mdContent: string, summarySection: string): string {
  if (!summarySection.trim()) return mdContent;
  return `${mdContent}\n\n## AI Summary\n\n${summarySection}\n`;
}
