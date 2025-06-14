import fs from 'fs';

import YAML from 'yaml';

import 'dotenv/config';
import { ConfigError } from '../errors/index.js';

export interface AppConfig {
  apiKey: string;
  urls: string[];
  strategies: string[];
  concurrency: number;
  runsPerUrl: number;
  cfgPath: string;
  detailedReport: boolean;
  ai: {
    enabled: boolean;
    apiKey?: string;
    model: string;
  };
}

export function loadConfig(): AppConfig {
  const apiKey = process.env.PSI_KEY;
  if (!apiKey) {
    throw new ConfigError('Missing PSI_KEY in environment');
  }

  const cfgPath = (process.env.PSI_CONFIG_FILE || 'urls.yml').trim();
  let urls: string[];

  try {
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const parsed = YAML.parse(raw);
    urls = parsed?.urls ?? [];
  } catch (err) {
    throw new ConfigError(`Could not read URLs from ${cfgPath}: ${(err as Error).message}`);
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    throw new ConfigError(`No URLs found in ${cfgPath}`);
  }

  const strategies = (process.env.PSI_STRATEGIES || 'desktop,mobile')
    .split(',')
    .map((s: string) => s.trim());
  const concurrency = parseInt(process.env.PSI_CONCURRENCY || '4', 10);
  const runsPerUrl = parseInt(process.env.PSI_RUNS_PER_URL || '1', 10);

  // Detailed report configuration
  const detailedReport = process.env.PSI_DETAILED_REPORT?.toLowerCase() === 'true';

  // --- AI configuration processing ---
  const aiEnabledEnv = process.env.AI_SUMMARY_ENABLED ?? 'false';
  const aiEnabled = aiEnabledEnv.toLowerCase() === 'true';
  const openAIApiKey = process.env.OPENAI_API_KEY;
  const openAIModel = (process.env.OPENAI_MODEL || 'gpt-3.5-turbo').trim();

  if (aiEnabled && !openAIApiKey) {
    // Warn but do not throw; feature will be disabled gracefully
    console.warn(
      'AI summaries are enabled (AI_SUMMARY_ENABLED=true), but OPENAI_API_KEY is missing. Skipping summaries.'
    );
  }

  const aiConfig = {
    enabled: aiEnabled && !!openAIApiKey,
    apiKey: openAIApiKey,
    model: openAIModel,
  } as const;

  return {
    apiKey,
    urls,
    strategies,
    concurrency,
    runsPerUrl,
    cfgPath,
    detailedReport,
    ai: aiConfig,
  };
}
