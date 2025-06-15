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
  vi.resetAllMocks();
  global.fetch = ORIGINAL_FETCH;
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

describe('GptService.generateComprehensiveReportSummary - Basic API Tests', () => {
  const dummyKey = 'sk-123';
  const minimalPsiData = {
    url: 'https://example.com',
    strategy: 'desktop' as const,
    performanceScore: 90,
    metrics: {
      lcp: 1500,
      fcp: 800,
      cls: 0.05,
      tbt: 50,
      si: 1200,
    },
    opportunities: [],
    diagnostics: [],
    passedAudits: [],
    lighthouseVersion: '10.0.0',
    fetchTime: '2025-01-01T00:00:00.000Z',
  };

  it('returns summary string when API responds 200', async () => {
    const mockSummary = '### Performance Analysis\nExcellent performance';
    mockFetch({ ok: true, status: 200 }, {
      choices: [
        { message: { content: mockSummary } },
      ],
    });

    const svc = new GptService({ apiKey: dummyKey });
    const summary = await svc.generateComprehensiveReportSummary(minimalPsiData);

    expect(summary).toBe(mockSummary);
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch({ ok: false, status: 401 }, { error: 'unauthorized' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when response has unexpected shape', async () => {
    mockFetch({ ok: true, status: 200 }, { unexpected: 'shape' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when choices array is empty', async () => {
    mockFetch({ ok: true, status: 200 }, { choices: [] });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when message content is not a string', async () => {
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: 123 } }],
    });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when response is not valid JSON', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
      text: async () => 'invalid json',
    })) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    const promise = svc.generateComprehensiveReportSummary(minimalPsiData);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toThrow('Unexpected OpenAI API response shape');
  });

  it('handles error response text gracefully when response.text() fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('Failed to read text')),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError on network error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('net fail'))) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError on 429 rate limit error', async () => {
    mockFetch({ ok: false, status: 429 }, { error: 'rate limit exceeded' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toThrow('OpenAI API error (429)');
  });

  it('throws ApiError on 500 server error', async () => {
    mockFetch({ ok: false, status: 500 }, { error: 'server error' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toThrow('OpenAI API error (500)');
  });

  it('throws ApiError when choices[0] is null or malformed', async () => {
    const svc = new GptService({ apiKey: dummyKey });

    mockFetch({ ok: true, status: 200 }, { choices: [null] });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toThrow(
      'Unexpected OpenAI API response shape'
    );

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: null }] });
    await expect(svc.generateComprehensiveReportSummary(minimalPsiData)).rejects.toThrow(
      'Unexpected OpenAI API response shape'
    );
  });

  it('handles empty string content from API', async () => {
    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: '' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    const summary = await svc.generateComprehensiveReportSummary(minimalPsiData);
    expect(summary).toBe('');
  });
});

describe('GptService.generateComprehensiveReportSummary', () => {
  const dummyKey = 'sk-123';
  const comprehensiveData = {
    url: 'https://example.com',
    strategy: 'desktop' as const,
    performanceScore: 85,
    metrics: {
      lcp: 2500,
      fcp: 1200,
      cls: 0.1,
      tbt: 150,
      si: 1800,
    },
    opportunities: [
      {
        id: 'unused-css-rules',
        title: 'Remove unused CSS',
        description: 'Remove dead rules from stylesheets.',
        score: 0.3,
        scoreDisplayMode: 'metricSavings' as const,
        displayValue: 'Potential savings of 1,024 KiB',
        metricSavings: { LCP: 200, FCP: 100 },
        details: {
          type: 'opportunity' as const,
          items: [
            {
              url: 'https://example.com/styles.css',
              wastedBytes: 1048576,
            },
          ],
          headings: [
            { key: 'url', valueType: 'url' as const, label: 'URL' },
          ],
        },
      },
    ],
    diagnostics: [
      {
        id: 'dom-size',
        title: 'Avoid an excessive DOM size',
        description: 'A large DOM will increase memory usage.',
        score: null,
        scoreDisplayMode: 'informative' as const,
        displayValue: '1,500 elements',
        details: {
          type: 'table' as const,
          items: [
            {
              node: {
                type: 'node' as const,
                path: 'body > div',
                selector: 'body > div.container',
                snippet: '<div class="container">...</div>',
                nodeLabel: 'Container',
              },
            },
          ],
          headings: [
            { key: 'node', valueType: 'node' as const, label: 'Element' },
          ],
        },
      },
    ],
    passedAudits: [],
    lighthouseVersion: '10.0.0',
    fetchTime: '2025-01-01T00:00:00.000Z',
  };

  it('returns comprehensive summary when API responds successfully', async () => {
    const mockSummary = '### Performance Analysis\n\nGood overall performance with some opportunities.';
    mockFetch({ ok: true, status: 200 }, {
      choices: [
        { message: { content: mockSummary } },
      ],
    });

    const svc = new GptService({ apiKey: dummyKey });
    const summary = await svc.generateComprehensiveReportSummary(comprehensiveData);

    expect(summary).toBe(mockSummary);
  });

  it('throws ApiError on API failure', async () => {
    mockFetch({ ok: false, status: 500 }, { error: 'server error' });
    const svc = new GptService({ apiKey: dummyKey });
    await expect(svc.generateComprehensiveReportSummary(comprehensiveData)).rejects.toBeInstanceOf(ApiError);
  });

  it('builds comprehensive prompt with audit data', async () => {
    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: mockSummary } }],
    });

    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(comprehensiveData);

    // Verify the prompt includes key information
    const fetchCall = global.fetch as any;
    expect(fetchCall).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dummyKey}`,
        }),
        body: expect.stringContaining('https://example.com'),
      })
    );

    // Parse and check the request body
    const requestBody = JSON.parse(fetchCall.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;

    expect(prompt).toContain('Website: https://example.com (desktop analysis)');
    expect(prompt).toContain('Current Performance Score: 85/100 (good performance)');
    expect(prompt).toContain('LCP 2500ms | FCP 1200ms | CLS 0.1 | TBT 150ms | SI 1800ms');
    expect(prompt).toContain('Remove unused CSS');
    expect(prompt).toContain('Avoid an excessive DOM size');
    expect(prompt).toContain('styles.css (1024KB wasted)');
    expect(prompt).toContain('body > div.container'); // The element selector appears in the prompt
  });

  it('handles different performance score severities', async () => {
    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: mockSummary } }] });
    const svc = new GptService({ apiKey: dummyKey });

    // Test "poor" severity
    await svc.generateComprehensiveReportSummary({ ...comprehensiveData, performanceScore: 40 });
    let requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(requestBody.messages[0].content).toContain('(poor performance)');

    // Test "needs improvement" severity
    await svc.generateComprehensiveReportSummary({ ...comprehensiveData, performanceScore: 60 });
    requestBody = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    expect(requestBody.messages[0].content).toContain('(needs improvement performance)');

    // Test "good" severity
    await svc.generateComprehensiveReportSummary({ ...comprehensiveData, performanceScore: 80 });
    requestBody = JSON.parse((global.fetch as any).mock.calls[2][1].body);
    expect(requestBody.messages[0].content).toContain('(good performance)');
  });

  it('handles invalid URLs in opportunity items gracefully', async () => {
    const dataWithInvalidUrls = {
      ...comprehensiveData,
      opportunities: [
        {
          ...comprehensiveData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [{ url: 'invalid-url' }],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithInvalidUrls);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(requestBody.messages[0].content).toContain('invalid-url');
  });

  it('correctly identifies and prioritizes critical opportunities', async () => {
    const dataWithCriticalOpp = {
      ...comprehensiveData,
      opportunities: [
        {
          ...comprehensiveData.opportunities[0],
          title: 'Critical Opportunity',
          metricSavings: { LCP: 500 }, // High impact
        },
        {
          ...comprehensiveData.opportunities[0],
          title: 'Regular Opportunity',
          metricSavings: { FCP: 50 }, // Low impact
        },
      ],
    };
    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithCriticalOpp);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    expect(promptContent).toContain('[HIGH IMPACT] Critical Opportunity');
    expect(promptContent).toContain('[MEDIUM] Regular Opportunity');
  });

  it('handles opportunities without details', async () => {
    const dataWithoutDetails = {
      ...comprehensiveData,
      opportunities: [
        {
          id: 'simple-opportunity',
          title: 'Simple Opportunity',
          description: 'A simple opportunity',
          score: 0.5,
          scoreDisplayMode: 'metricSavings' as const,
          displayValue: 'Save 100ms',
          // No details property
        },
      ],
    };

    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: mockSummary } }],
    });

    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithoutDetails);

    const fetchCall = global.fetch as any;
    const requestBody = JSON.parse(fetchCall.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;

    expect(prompt).toContain('Simple Opportunity: Save 100ms (Multiple resources)');
  });

  it('handles diagnostics with URL items', async () => {
    const dataWithUrlDiagnostics = {
      ...comprehensiveData,
      diagnostics: [
        {
          id: 'url-diagnostic',
          title: 'URL Diagnostic',
          description: 'A diagnostic with URLs',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              { url: 'https://example.com/long/path/to/resource.js' },
              { url: 'https://example.com/script.js' },
            ],
            headings: [
              { key: 'url', valueType: 'url' as const, label: 'URL' },
            ],
          },
        },
      ],
    };

    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: mockSummary } }],
    });

    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithUrlDiagnostics);

    const fetchCall = global.fetch as any;
    const requestBody = JSON.parse(fetchCall.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;

    expect(prompt).toContain('URL Diagnostic (resource.js, script.js): Check implementation');
  });

  it('limits opportunities and diagnostics in prompt', async () => {
    const manyOpportunitiesData = {
      ...comprehensiveData,
      opportunities: Array.from({ length: 15 }, (_, i) => ({
        id: `opportunity-${i}`,
        title: `Opportunity ${i}`,
        description: `Description ${i}`,
        score: 0.5,
        scoreDisplayMode: 'metricSavings' as const,
        displayValue: `Save ${i * 100}ms`,
      })),
      diagnostics: Array.from({ length: 10 }, (_, i) => ({
        id: `diagnostic-${i}`,
        title: `Diagnostic ${i}`,
        description: `Description ${i}`,
        score: null,
        scoreDisplayMode: 'informative' as const,
      })),
    };

    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: mockSummary } }],
    });

    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(manyOpportunitiesData);

    const fetchCall = global.fetch as any;
    const requestBody = JSON.parse(fetchCall.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;

    // Should include opportunities (limited by the implementation logic)
    expect(prompt).toContain('Opportunity 0');
    expect(prompt).toContain('Opportunity 4'); // Implementation limits to first 5 regular opportunities
    expect(prompt).not.toContain('Opportunity 10');

    // Should include first 6 diagnostics (implementation limit)
    expect(prompt).toContain('Diagnostic 0');
    expect(prompt).toContain('Diagnostic 5'); // Implementation limits to first 6 diagnostics
    expect(prompt).not.toContain('Diagnostic 6');
  });

  it('handles empty opportunities and diagnostics gracefully', async () => {
    const emptyData = {
      ...comprehensiveData,
      opportunities: [],
      diagnostics: [],
    };

    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: mockSummary } }],
    });

    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(emptyData);

    const fetchCall = global.fetch as any;
    const requestBody = JSON.parse(fetchCall.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;

    expect(prompt).toContain('No major optimization opportunities identified');
    expect(prompt).toContain('No significant diagnostic issues found');
  });

  it('handles invalid URLs in diagnostic items gracefully', async () => {
    const dataWithInvalidUrls = {
      ...comprehensiveData,
      diagnostics: [
        {
          id: 'url-diagnostic',
          title: 'URL Diagnostic',
          description: 'A diagnostic with invalid URLs',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              { url: 'invalid-url-format' }, // This will cause URL constructor to throw
              { url: 'https://example.com/valid.js' },
            ],
            headings: [
              { key: 'url', valueType: 'url' as const, label: 'URL' },
            ],
          },
        },
      ],
    };

    const mockSummary = 'Generated summary';
    mockFetch({ ok: true, status: 200 }, {
      choices: [{ message: { content: mockSummary } }],
    });

    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithInvalidUrls);

    const fetchCall = global.fetch as any;
    const requestBody = JSON.parse(fetchCall.mock.calls[0][1].body);
    const prompt = requestBody.messages[0].content;

    // Should handle invalid URL gracefully and fall back to original string
    expect(prompt).toContain('invalid-url-format, valid.js');
  });

  it('calls safeReadText when response.text() is available', async () => {
    // Create a response that fails when reading text
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('Failed to read')),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    const svc = new GptService({ apiKey: dummyKey });
    
    try {
      await svc.generateComprehensiveReportSummary(comprehensiveData);
    } catch (error) {
      // Expected to throw ApiError
      expect(error).toBeInstanceOf(ApiError);
    }

    // Verify safeReadText was called and handled the error
    expect(mockResponse.text).toHaveBeenCalled();
  });

  it('handles opportunities with items that have no URL or node selector', async () => {
    const dataWithMixedItems = {
      ...comprehensiveData,
      opportunities: [
        {
          ...comprehensiveData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { wastedBytes: 1000 }, // No URL or node
              { label: 'Some resource' }, // No URL or node
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithMixedItems);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should fall back to 'Resource' for items without URL or node
    expect(promptContent).toContain('Resource, Resource');
  });

  it('handles diagnostics with items that have no URL or node selector', async () => {
    const dataWithMixedDiagnostics = {
      ...comprehensiveData,
      diagnostics: [
        {
          id: 'mixed-diagnostic',
          title: 'Mixed Diagnostic',
          description: 'A diagnostic with mixed items',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              { score: 0.5 }, // No URL or node
              { label: 'Some item' }, // No URL or node
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithMixedDiagnostics);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should fall back to 'See details' for items without URL or node
    expect(promptContent).toContain('Mixed Diagnostic (See details, See details): Check implementation');
  });

  it('handles opportunities with empty pathname in URL', async () => {
    const dataWithRootUrls = {
      ...comprehensiveData,
      opportunities: [
        {
          ...comprehensiveData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/' }, // Root path
              { url: 'https://example.com' }, // No trailing slash
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithRootUrls);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should handle root paths gracefully
    expect(promptContent).toContain('/, ');
  });

  it('handles diagnostics with empty pathname in URL', async () => {
    const dataWithRootUrls = {
      ...comprehensiveData,
      diagnostics: [
        {
          id: 'root-diagnostic',
          title: 'Root Diagnostic',
          description: 'A diagnostic with root URLs',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              { url: 'https://example.com/' }, // Root path
              { url: 'https://example.com' }, // No trailing slash
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithRootUrls);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should handle root paths gracefully
    expect(promptContent).toContain('Root Diagnostic (/, /): Check implementation');
  });

  it('handles opportunities with URLs that have empty filename after split', async () => {
    const dataWithTrailingSlashUrls = {
      ...comprehensiveData,
      opportunities: [
        {
          ...comprehensiveData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/path/to/directory/' }, // Trailing slash, pop() returns empty
              { url: 'https://example.com/path/to/file.js' }, // Normal file
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithTrailingSlashUrls);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should fall back to pathname when pop() returns empty string
    expect(promptContent).toContain('/path/to/directory/, file.js');
  });

  it('handles diagnostics with URLs that have empty filename after split', async () => {
    const dataWithTrailingSlashUrls = {
      ...comprehensiveData,
      diagnostics: [
        {
          id: 'trailing-slash-diagnostic',
          title: 'Trailing Slash Diagnostic',
          description: 'A diagnostic with trailing slash URLs',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              { url: 'https://example.com/path/to/directory/' }, // Trailing slash, pop() returns empty
              { url: 'https://example.com/path/to/file.js' }, // Normal file
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithTrailingSlashUrls);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should fall back to pathname when pop() returns empty string
    expect(promptContent).toContain('Trailing Slash Diagnostic (/path/to/directory/, file.js): Check implementation');
  });

  it('handles opportunities with URLs that have multiple trailing slashes', async () => {
    const dataWithMultipleSlashes = {
      ...comprehensiveData,
      opportunities: [
        {
          ...comprehensiveData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/path/to/directory///' }, // Multiple trailing slashes
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithMultipleSlashes);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should fall back to pathname when pop() returns empty string
    expect(promptContent).toContain('/path/to/directory///');
  });

  it('handles diagnostics with URLs that have multiple trailing slashes', async () => {
    const dataWithMultipleSlashes = {
      ...comprehensiveData,
      diagnostics: [
        {
          id: 'multiple-slash-diagnostic',
          title: 'Multiple Slash Diagnostic',
          description: 'A diagnostic with multiple trailing slash URLs',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              { url: 'https://example.com/path/to/directory///' }, // Multiple trailing slashes
            ],
            headings: [],
          },
        },
      ],
    };

    mockFetch({ ok: true, status: 200 }, { choices: [{ message: { content: 'summary' } }] });
    const svc = new GptService({ apiKey: dummyKey });
    await svc.generateComprehensiveReportSummary(dataWithMultipleSlashes);

    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const promptContent = requestBody.messages[0].content as string;

    // Should fall back to pathname when pop() returns empty string
    expect(promptContent).toContain('Multiple Slash Diagnostic (/path/to/directory///): Check implementation');
  });
}); 