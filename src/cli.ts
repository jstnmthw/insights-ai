#!/usr/bin/env node
import fs from 'fs';

import chalk from 'chalk';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';
import { Command } from 'commander';
import gradient from 'gradient-string';

import { loadConfig } from './config/index.js';
import { executeRuns } from './runner.js';
import { GptService } from './services/gptService.js';
import type { MedianResult } from './types/psi.js';
import { setupGlobalHandlers, logError } from './utils/errorHandler.js';
import {
  getScoreColor,
  getLcpColor,
  getFcpColor,
  getClsColor,
  getTbtColor,
  colorize,
} from './utils/metrics.js';
import { buildMarkdownReport, appendAiSummary } from './utils/reportBuilder.js';

// ---------------------------------------------------------
// Main function
// ---------------------------------------------------------
async function main(): Promise<void> {
  // Parse CLI flags & mirror into env vars before loading config
  parseCliArgs();

  const cfg = loadConfig();

  const { timestamp, subheaderPlain, runInfo } = printHeader(cfg);

  const totalTests = cfg.urls.length * cfg.strategies.length * cfg.runsPerUrl;
  const progressBar = new cliProgress.SingleBar({
    format:
      'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} tests | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  progressBar.start(totalTests, 0);

  const medianResults = await executeRuns((completed) => progressBar.update(completed));

  progressBar.stop();
  console.log(chalk.green('\n✓ All tests completed!\n'));

  // Display results table
  renderResultsTable(medianResults);

  // Generate Markdown report using helper
  let mdContent = buildMarkdownReport(cfg, medianResults, subheaderPlain, runInfo);

  // Generate AI summaries
  if (cfg.ai.enabled && cfg.ai.apiKey) {
    mdContent = await generateAiSummary(cfg, medianResults, mdContent);
  }

  const outDir = 'logs';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(`${outDir}/psi-report-${timestamp}.md`, mdContent);
  console.log(chalk.green(`\n📄 Report saved to: ${outDir}/psi-report-${timestamp}.md`));
}

// ---------------------------------------------------------
// Helper functions (extracted for readability & testability)
// ---------------------------------------------------------

function parseCliArgs(): void {
  const program = new Command();
  program
    .option('-c, --config <file>', 'Path to YAML config file')
    .option('-k, --key <key>', 'PSI API Key')
    .option('-s, --strategies <list>', 'Comma-separated list of strategies (desktop,mobile)')
    .option('-p, --concurrency <number>', 'Concurrency level', (v: string) => parseInt(v, 10))
    .option('-r, --runs <number>', 'Runs per URL', (v: string) => parseInt(v, 10))
    .parse(process.argv);

  const opts = program.opts<Record<string, string>>();

  // Override env vars – keeps loadConfig implementation simple.
  if (opts.config) process.env.PSI_CONFIG_FILE = opts.config;
  if (opts.key) process.env.PSI_KEY = opts.key;
  if (opts.strategies) process.env.PSI_STRATEGIES = opts.strategies;
  if (opts.concurrency) process.env.PSI_CONCURRENCY = String(opts.concurrency);
  if (opts.runs) process.env.PSI_RUNS_PER_URL = String(opts.runs);
}

function printHeader(cfg: ReturnType<typeof loadConfig>): {
  timestamp: string;
  subheaderPlain: string;
  runInfo: string;
} {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  const runDate = now.toLocaleString();

  console.clear();
  const header = gradient(['#4A90E2', '#8E44AD', '#E91E63'])('InsightsAI') + ' - Running Analysis';
  const subheader = `Testing ${chalk.green(cfg.urls.length)} URL(s) × ${chalk.green(
    cfg.strategies.length
  )} strategies × ${chalk.green(cfg.runsPerUrl)} run(s)`;
  const subheaderPlain = `Testing ${cfg.urls.length} URL(s) × ${cfg.strategies.length} strategies × ${cfg.runsPerUrl} run(s)`;
  const runInfo = `Started at ${runDate}`;

  // AI summary status information
  const aiStatusColored = cfg.ai.enabled ? chalk.green('Enabled') : chalk.gray('Disabled');
  const aiInfo = `AI Summaried: ${aiStatusColored}`;

  console.log(`${header}\n${subheader}\n${runInfo}\n${aiInfo}\n`);

  return { timestamp, subheaderPlain, runInfo };
}

function renderResultsTable(results: MedianResult[]): void {
  console.log(chalk.bold('Final Results (Medians):\n'));
  const table = new Table({
    head: ['URL', 'Strategy', 'Runs', 'Score', 'LCP', 'FCP', 'CLS', 'TBT'].map((h) =>
      chalk.gray.bold(h)
    ),
    colAligns: ['left', 'center', 'center', 'right', 'right', 'right', 'right', 'right'],
  });

  const formatMetric = (value: number, unit: 'ms' | 's' = 'ms'): string => {
    if (value === 0) return 'n/a';
    if (unit === 'ms') return `${Math.round(value)} ms`;
    return `${(value / 1000).toFixed(1)} s`;
  };

  results.forEach((r) => {
    table.push([
      r.url,
      r.strategy,
      r.runs,
      colorize(r.medianScore, getScoreColor(r.medianScore)),
      colorize(formatMetric(r.medianLcp), getLcpColor(r.medianLcp)),
      colorize(formatMetric(r.medianFcp), getFcpColor(r.medianFcp)),
      colorize(r.medianCls.toFixed(3), getClsColor(r.medianCls)),
      colorize(formatMetric(r.medianTbt), getTbtColor(r.medianTbt)),
    ]);
  });

  console.log(table.toString());
}

async function generateAiSummary(
  cfg: ReturnType<typeof loadConfig>,
  medianResults: MedianResult[],
  mdContent: string
): Promise<string> {
  if (!cfg.ai.enabled || !cfg.ai.apiKey) return mdContent;

  console.log(chalk.cyan('Generating AI summaries...'));

  const gpt = new GptService({ apiKey: cfg.ai.apiKey, model: cfg.ai.model });
  const summaries: string[] = [];

  for (const r of medianResults) {
    try {
      const condensed = {
        url: r.url,
        strategy: r.strategy,
        score: r.medianScore,
        lcp: r.medianLcp,
        fcp: r.medianFcp,
        cls: r.medianCls,
        tbt: r.medianTbt,
      } as const;

      let summary = await gpt.generateReportSummary(condensed);

      // Strip potential code fences
      summary = summary
        .replace(/^```[a-zA-Z]*\n?/u, '')
        .replace(/```$/u, '')
        .trim();

      // Ensure consistent headers and per-recommendation Cursor links
      const lines = summary.split('\n');
      const processed: string[] = [`# Performance Analysis for ${r.url} (${r.strategy})`];

      // Normalize subsequent headers and attach links to bullets
      lines.forEach((line) => {
        const trimmed = line.trim();

        // Skip filler phrases or horizontal rules returned by the model
        if (trimmed === '' || /^---+$/.test(trimmed) || /^certainly/i.test(trimmed)) return;

        if (/^#+\s*overview/i.test(trimmed)) processed.push('### Overview');
        else if (/^#+\s*key\s*issues/i.test(trimmed)) processed.push('### Key Issues');
        else if (/^#+\s*recommendations?/i.test(trimmed)) processed.push('### Recommendations');
        else if (trimmed.startsWith('- ')) {
          const recText = trimmed.replace(/^-\s+/, '');
          const linkPrompt = encodeURIComponent(
            `I have this Lighthouse recommendation: ${recText}. How do I implement it?`
          );
          processed.push(`${trimmed} [Fix in Cursor](https://www.cursor.sh/?prompt=${linkPrompt})`);
        } else if (trimmed !== '') {
          processed.push(line);
        }
      });

      summary = processed.join('\n');

      summaries.push(summary);
    } catch (err) {
      console.error('Warning: failed to generate AI summary:', err);
    }
  }

  if (summaries.length > 0) {
    console.log(chalk.green('✓ AI summaries generated.'));
    return appendAiSummary(mdContent, summaries.join('\n\n'));
  }
  console.log(chalk.yellow('No AI summaries generated.'));
  return mdContent;
}

setupGlobalHandlers();

export { main };

if (!('vitest' in import.meta)) {
  main().catch((err) => {
    logError(err);
    process.exit(1);
  });
}
