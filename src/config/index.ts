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

  return {
    apiKey,
    urls,
    strategies,
    concurrency,
    runsPerUrl,
    cfgPath,
  };
}
