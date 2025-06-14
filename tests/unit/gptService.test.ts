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

  it('throws ApiError on network error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('net fail'))) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateReportSummary(psiData)).rejects.toBeInstanceOf(ApiError);
  });
}); 