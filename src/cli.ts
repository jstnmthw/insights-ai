#!/usr/bin/env node
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';
import fs from 'fs';
import { Command } from 'commander';
import { executeRuns } from './runner.js';
import {
  getScoreColor,
  getLcpColor,
  getFcpColor,
  getClsColor,
  getTbtColor,
  colorize,
  getScoreEmoji,
  getLcpEmoji,
  getFcpEmoji,
  getClsEmoji,
  getTbtEmoji,
} from './utils/metrics.js';
import { loadConfig } from './config/index.js';
import { setupGlobalHandlers, logError } from './utils/errorHandler.js';

async function main(): Promise<void> {
  // CLI options override env variables
  const program = new Command();
  program
    .option('-c, --config <file>', 'Path to YAML config file')
    .option('-k, --key <key>', 'PSI API Key')
    .option('-s, --strategies <list>', 'Comma-separated list of strategies (desktop,mobile)')
    .option('-p, --concurrency <number>', 'Concurrency level', (v: string) => parseInt(v, 10))
    .option('-r, --runs <number>', 'Runs per URL', (v: string) => parseInt(v, 10))
    .parse(process.argv);

  const opts = program.opts<Record<string, string>>();

  // Inject options to process.env before config load
  if (opts.config) process.env.PSI_CONFIG_FILE = opts.config;
  if (opts.key) process.env.PSI_KEY = opts.key;
  if (opts.strategies) process.env.PSI_STRATEGIES = opts.strategies;
  if (opts.concurrency) process.env.PSI_CONCURRENCY = String(opts.concurrency);
  if (opts.runs) process.env.PSI_RUNS_PER_URL = String(opts.runs);

  const cfg = loadConfig();

  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  const runDate = now.toLocaleString();

  console.clear();
  const header = chalk.bold('InsightsAI Analysis');
  const subheader = `Testing ${cfg.urls.length} URL(s) × ${cfg.strategies.length} strategies × ${cfg.runsPerUrl} run(s)`;
  const runInfo = `Started at ${runDate}`;

  console.log(`${header}\n${subheader}\n${runInfo}\n`);

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
  console.log(chalk.bold('Final Results (Medians):\n'));
  const finalTable = new Table({
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

  medianResults.forEach((r) => {
    finalTable.push([
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

  console.log(finalTable.toString());

  // Generate Markdown report
  let mdContent = `# InsightsAI Analysis\n\n${subheader}\n${runInfo}\n\n`;
  mdContent += '## Legend\n\n';
  mdContent += '- 🟢 Good: Performance meets or exceeds recommended thresholds\n';
  mdContent +=
    '- 🟡 Needs Improvement: Performance is below recommended thresholds but not critical\n';
  mdContent += '- 🔴 Poor: Performance is significantly below recommended thresholds\n\n';

  mdContent += '## Final Results (Medians)\n\n';
  mdContent += '| URL | Strategy | Runs | Score | LCP | FCP | CLS | TBT |\n';
  mdContent += '| :-- | :------: | :--: | ----: | --: | --: | --: | --: |\n';
  medianResults.forEach((r) => {
    mdContent += `| ${r.url} | ${r.strategy} | ${r.runs} | ${getScoreEmoji(r.medianScore)} ${r.medianScore} | ${getLcpEmoji(r.medianLcp)} ${formatMetric(r.medianLcp)} | ${getFcpEmoji(r.medianFcp)} ${formatMetric(r.medianFcp)} | ${getClsEmoji(r.medianCls)} ${r.medianCls.toFixed(3)} | ${getTbtEmoji(r.medianTbt)} ${formatMetric(r.medianTbt)} |\n`;
  });

  const outDir = 'output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(`${outDir}/psi-report-${timestamp}.md`, mdContent);
  console.log(chalk.green(`\n📄 Report saved to: ${outDir}/psi-report-${timestamp}.md`));
}

setupGlobalHandlers();

main().catch((err) => {
  logError(err);
  process.exit(1);
});
