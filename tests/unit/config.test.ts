import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../../src/config/index.js';
import { ConfigError } from '../../src/errors/index.js';

const fixturePath = path.resolve(__dirname, '../fixtures/sample-urls.yml');

// Helper to set and restore env vars
const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>): void {
  Object.assign(process.env, env);
}

function clearEnv(): void {
  process.env = { ...ORIGINAL_ENV };
}

afterEach(() => {
  clearEnv();
});

describe('config/loadConfig', () => {
  it('loads configuration successfully', () => {
    setEnv({
      PSI_KEY: 'dummy-key',
      PSI_CONFIG_FILE: fixturePath,
      PSI_STRATEGIES: 'desktop,mobile',
      PSI_CONCURRENCY: '2',
      PSI_RUNS_PER_URL: '3',
    });

    const cfg = loadConfig();

    expect(cfg).toEqual(
      expect.objectContaining({
        apiKey: 'dummy-key',
        urls: ['https://example.com', 'https://google.com'],
        strategies: ['desktop', 'mobile'],
        concurrency: 2,
        runsPerUrl: 3,
        cfgPath: fixturePath,
        ai: expect.any(Object),
      })
    );
  });

  it('throws ConfigError when PSI_KEY is missing', () => {
    setEnv({ PSI_KEY: undefined, PSI_CONFIG_FILE: fixturePath });

    expect(() => loadConfig()).toThrowError(ConfigError);
  });

  it('throws ConfigError when YAML file is missing', () => {
    setEnv({ PSI_KEY: 'dummy', PSI_CONFIG_FILE: 'non-existent.yml' });

    expect(() => loadConfig()).toThrowError(ConfigError);
  });

  it('throws ConfigError when no URLs are present', () => {
    // Create a temp YAML with empty urls list
    const tempPath = path.join(__dirname, 'empty-urls.yml');
    fs.writeFileSync(tempPath, 'urls: []');

    setEnv({ PSI_KEY: 'dummy', PSI_CONFIG_FILE: tempPath });

    expect(() => loadConfig()).toThrowError(ConfigError);

    fs.unlinkSync(tempPath);
  });

  it('uses default env values when optional vars absent', () => {
    clearEnv();
    delete process.env.PSI_STRATEGIES;
    process.env.PSI_KEY = 'abc';
    // create temp urls file
    const tempPath = path.join(__dirname, 'one-url.yml');
    fs.writeFileSync(tempPath, 'urls:\n  - https://a.com');
    process.env.PSI_CONFIG_FILE = tempPath;

    const cfg = loadConfig();

    expect(cfg.strategies).toEqual(['desktop', 'mobile']);
    expect(cfg.concurrency).toBe(4);
    expect(cfg.runsPerUrl).toBe(1);

    fs.unlinkSync(tempPath);
  });

  it('parses AI config correctly', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      AI_SUMMARY_ENABLED: 'true',
      OPENAI_API_KEY: 'openai-key',
    });

    const cfg = loadConfig();
    expect(cfg.ai).toEqual({ enabled: true, apiKey: 'openai-key', model: 'gpt-3.5-turbo' });
  });

  it('warns and disables AI when enabled but API key missing', () => {
    const originalWarn = console.warn;
    const warnSpy = vi.fn();
    console.warn = warnSpy;

    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      AI_SUMMARY_ENABLED: 'true',
      OPENAI_API_KEY: undefined,
    });

    const cfg = loadConfig();
    
    expect(warnSpy).toHaveBeenCalledWith(
      'AI summaries are enabled (AI_SUMMARY_ENABLED=true), but OPENAI_API_KEY is missing. Skipping summaries.'
    );
    expect(cfg.ai.enabled).toBe(false);
    expect(cfg.ai.apiKey).toBeUndefined();

    console.warn = originalWarn;
  });
});
