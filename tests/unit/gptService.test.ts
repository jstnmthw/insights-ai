import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'node-fetch';

import { GptService } from '../../src/services/gptService.js';
import { ApiError } from '../../src/errors/index.js';

const ORIGINAL_FETCH = global.fetch;

function mockFetch(responseInit: Partial<Response>, json: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: responseInit.ok ?? true,
    status: responseInit.status ?? 200,
    json: async () => json,
    text: async () => JSON.stringify(json),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('GptService constructor', () => {
  it('throws ApiError when no API key provided', () => {
    expect(() => new GptService({ apiKey: '' })).toThrowError(ApiError);
    expect(() => new GptService({ apiKey: null as any })).toThrowError(ApiError);
    expect(() => new GptService({ apiKey: undefined as any })).toThrowError(ApiError);
  });

  it('uses default model when none specified', () => {
    const svc = new GptService({ apiKey: 'sk-123' });
    expect(svc['model']).toBe('gpt-3.5-turbo');
  });

  it('uses custom model when specified', () => {
    const svc = new GptService({ apiKey: 'sk-123', model: 'gpt-4' });
    expect(svc['model']).toBe('gpt-4');
  });
});

describe('GptService.generateReportSummary', () => {
  const dummyKey = 'sk-123';
  const psiData = { score: 90 };

  it('returns summary string when API responds 200', async () => {
    const mockSummary = '### Overview\nGood page';
    mockFetch({ ok: true, status: 200 }, {
      choices: [
        { message: { content: mockSummary } },
      ],
    });

    const svc = new GptService({ apiKey: dummyKey });
    const summary = await svc.generateReportSummary(psiData);

    expect(summary).toBe(mockSummary);
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch({ ok: false, status: 401 }, { error: 'unauthorized' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when response has unexpected shape', async () => {
    mockFetch({ ok: true, status: 200 }, { unexpected: 'shape' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when choices array is empty', async () => {
    mockFetch({ ok: true, status: 200 }, { choices: [] });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when message content is not a string', async () => {
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: 123 } }],
    });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('handles error response text gracefully when response.text() fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('Failed to read text')),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError on network error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('net fail'))) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });
}); 