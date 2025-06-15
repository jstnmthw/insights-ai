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

  it('throws ConfigError when urls property is missing from YAML', () => {
    // Create a temp YAML without urls property
    const tempPath = path.join(__dirname, 'no-urls-property.yml');
    fs.writeFileSync(tempPath, 'other_property: value');

    setEnv({ PSI_KEY: 'dummy', PSI_CONFIG_FILE: tempPath });

    expect(() => loadConfig()).toThrowError(ConfigError);

    fs.unlinkSync(tempPath);
  });

  it('throws ConfigError when YAML is completely empty', () => {
    // Create a temp YAML that's completely empty
    const tempPath = path.join(__dirname, 'empty.yml');
    fs.writeFileSync(tempPath, '');

    setEnv({ PSI_KEY: 'dummy', PSI_CONFIG_FILE: tempPath });

    expect(() => loadConfig()).toThrowError(ConfigError);

    fs.unlinkSync(tempPath);
  });

  it('uses default env values when optional vars absent', () => {
    clearEnv();
    delete process.env.PSI_STRATEGIES;
    delete process.env.PSI_CONCURRENCY;
    delete process.env.PSI_RUNS_PER_URL;
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
      OPENAI_MODEL: 'gpt-3.5-turbo',
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

  it('disables AI when AI_SUMMARY_ENABLED is false', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      AI_SUMMARY_ENABLED: 'false',
      OPENAI_API_KEY: 'openai-key',
    });

    const cfg = loadConfig();
    expect(cfg.ai.enabled).toBe(false);
    expect(cfg.ai.apiKey).toBe('openai-key');
  });

  it('disables AI when AI_SUMMARY_ENABLED is not set', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      OPENAI_API_KEY: 'openai-key',
    });
    delete process.env.AI_SUMMARY_ENABLED;

    const cfg = loadConfig();
    expect(cfg.ai.enabled).toBe(false);
    expect(cfg.ai.apiKey).toBe('openai-key');
  });

  it('handles case-insensitive AI_SUMMARY_ENABLED values', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      AI_SUMMARY_ENABLED: 'TRUE',
      OPENAI_API_KEY: 'openai-key',
    });

    const cfg = loadConfig();
    expect(cfg.ai.enabled).toBe(true);
  });

  it('uses default OpenAI model when not specified', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      AI_SUMMARY_ENABLED: 'true',
      OPENAI_API_KEY: 'openai-key',
    });
    delete process.env.OPENAI_MODEL;

    const cfg = loadConfig();
    expect(cfg.ai.model).toBe('gpt-3.5-turbo');
  });

  it('trims whitespace from OpenAI model', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: fixturePath,
      AI_SUMMARY_ENABLED: 'true',
      OPENAI_API_KEY: 'openai-key',
      OPENAI_MODEL: '  gpt-4  ',
    });

    const cfg = loadConfig();
    expect(cfg.ai.model).toBe('gpt-4');
  });

  it('trims whitespace from config file path', () => {
    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: `  ${fixturePath}  `, // Whitespace around path
    });

    const cfg = loadConfig();
    expect(cfg.cfgPath).toBe(fixturePath); // Should be trimmed
    expect(cfg.urls).toEqual(['https://example.com', 'https://google.com']);
  });

  it('uses default config file when PSI_CONFIG_FILE is empty string', () => {
    // Create a temp urls.yml file in the test directory
    const tempPath = path.join(__dirname, 'urls.yml');
    fs.writeFileSync(tempPath, 'urls:\n  - https://test.com');

    const originalCwd = process.cwd();
    process.chdir(__dirname); // Change to test directory so 'urls.yml' can be found

    setEnv({
      PSI_KEY: 'k',
      PSI_CONFIG_FILE: '', // Empty string should trigger fallback to 'urls.yml'
    });

    const cfg = loadConfig();
    expect(cfg.cfgPath).toBe('urls.yml'); // Should use default
    expect(cfg.urls).toEqual(['https://test.com']);

    // Cleanup
    process.chdir(originalCwd);
    fs.unlinkSync(tempPath);
  });
});
