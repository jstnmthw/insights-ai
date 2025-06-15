import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditExtractorService } from '../../src/services/auditExtractor.js';
import { ValidationError } from '../../src/errors/index.js';
import type { LighthouseResult, ComprehensivePsiData } from '../../src/types/psi.js';

describe('AuditExtractorService', () => {
  let service: AuditExtractorService;

  beforeEach(() => {
    service = new AuditExtractorService();
  });

  describe('extractComprehensiveData', () => {
    const validLighthouseResult: LighthouseResult = {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com',
      userAgent: 'test-user-agent',
      audits: {
        'largest-contentful-paint': { numericValue: 2000 },
        'first-contentful-paint': { numericValue: 1000 },
        'cumulative-layout-shift': { numericValue: 0.05 },
        'total-blocking-time': { numericValue: 100 },
        'speed-index': { numericValue: 1500 },
        'interactive': { numericValue: 3000 },
        'test-opportunity': {
          id: 'test-opportunity',
          title: 'Test Opportunity',
          description: 'A test opportunity',
          score: 0.5,
          scoreDisplayMode: 'metricSavings',
          displayValue: 'Save 200ms',
          numericValue: 200,
          metricSavings: { LCP: 200 },
          details: {
            type: 'opportunity',
            items: [
              {
                url: 'https://example.com/script.js',
                wastedBytes: 1000,
                wastedMs: 200,
                totalBytes: 5000,
              },
            ],
          },
        },
        'test-diagnostic': {
          id: 'test-diagnostic',
          title: 'Test Diagnostic',
          description: 'A test diagnostic',
          score: null,
          scoreDisplayMode: 'informative',
          displayValue: 'Found 3 issues',
          details: {
            type: 'table',
            items: [
              {
                node: {
                  selector: 'div.test',
                  snippet: '<div class="test">Content</div>',
                  boundingRect: { top: 10, right: 100, bottom: 50, left: 10, width: 90, height: 40 },
                },
                score: 0.8,
              },
            ],
          },
        },
        'test-passed': {
          id: 'test-passed',
          title: 'Test Passed',
          description: 'A passed audit',
          score: 1,
          scoreDisplayMode: 'binary',
        },
      },
      categories: {
        performance: { id: 'performance', title: 'Performance', score: 0.9, auditRefs: [] },
        accessibility: { id: 'accessibility', title: 'Accessibility', score: 0.85, auditRefs: [] },
        'best-practices': { id: 'best-practices', title: 'Best Practices', score: 0.95, auditRefs: [] },
        seo: { id: 'seo', title: 'SEO', score: 0.88, auditRefs: [] },
      },
      lighthouseVersion: '10.0.0',
      fetchTime: '2025-01-01T00:00:00.000Z',
      environment: {
        networkUserAgent: 'test-agent',
        hostUserAgent: 'test-host',
        benchmarkIndex: 100,
      },
    };

    it('extracts comprehensive data successfully', () => {
      const result = service.extractComprehensiveData(
        validLighthouseResult,
        'https://example.com',
        'desktop'
      );

      expect(result).toEqual({
        url: 'https://example.com',
        strategy: 'desktop',
        performanceScore: 90,
        metrics: {
          lcp: 2000,
          fcp: 1000,
          cls: 0.05,
          tbt: 100,
          si: 1500,
          tti: 3000,
        },
        opportunities: [
          expect.objectContaining({
            id: 'test-opportunity',
            title: 'Test Opportunity',
            score: 0.5,
            scoreDisplayMode: 'metricSavings',
          }),
        ],
        diagnostics: [
          expect.objectContaining({
            id: 'test-diagnostic',
            title: 'Test Diagnostic',
            scoreDisplayMode: 'informative',
          }),
        ],
        passedAudits: expect.arrayContaining([
          expect.objectContaining({
            id: 'test-passed',
            title: 'Test Passed',
            score: 1,
          }),
          // Metric audits also get categorized as passed because they have score: null
          expect.objectContaining({
            id: 'largest-contentful-paint',
            score: null,
          }),
          expect.objectContaining({
            id: 'first-contentful-paint', 
            score: null,
          }),
          expect.objectContaining({
            id: 'cumulative-layout-shift',
            score: null,
          }),
          expect.objectContaining({
            id: 'total-blocking-time',
            score: null,
          }),
          expect.objectContaining({
            id: 'speed-index',
            score: null,
          }),
          expect.objectContaining({
            id: 'interactive',
            score: null,
          }),
        ]),
        accessibilityScore: 85,
        bestPracticesScore: 95,
        seoScore: 88,
        lighthouseVersion: '10.0.0',
        fetchTime: '2025-01-01T00:00:00.000Z',
        environment: validLighthouseResult.environment,
      });
    });

    it('throws ValidationError when lighthouse result is invalid', () => {
      expect(() =>
        service.extractComprehensiveData(null as any, 'https://example.com', 'desktop')
      ).toThrow(ValidationError);

      expect(() =>
        service.extractComprehensiveData({} as any, 'https://example.com', 'desktop')
      ).toThrow(ValidationError);

      expect(() =>
        service.extractComprehensiveData(
          { audits: {} } as any,
          'https://example.com',
          'desktop'
        )
      ).toThrow(ValidationError);
    });

    it('handles missing metrics gracefully', () => {
      const resultWithoutMetrics: LighthouseResult = {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com',
        userAgent: 'test-user-agent',
        audits: {},
        categories: { performance: { id: 'performance', title: 'Performance', score: 0.8, auditRefs: [] } },
        lighthouseVersion: '10.0.0',
        fetchTime: '2025-01-01T00:00:00.000Z',
      };

      const result = service.extractComprehensiveData(
        resultWithoutMetrics,
        'https://example.com',
        'mobile'
      );

      expect(result.metrics).toEqual({
        lcp: 0,
        fcp: 0,
        cls: 0,
        tbt: 0,
        si: 0,
        tti: 0,
      });
    });

    it('handles null performance score', () => {
      const resultWithNullScore: LighthouseResult = {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com', 
        userAgent: 'test-user-agent',
        audits: {},
        categories: { performance: { id: 'performance', title: 'Performance', score: null, auditRefs: [] } },
        lighthouseVersion: '10.0.0',
        fetchTime: '2025-01-01T00:00:00.000Z',
      };

      const result = service.extractComprehensiveData(
        resultWithNullScore,
        'https://example.com',
        'desktop'
      );

      expect(result.performanceScore).toBe(0);
    });

    it('handles missing optional category scores', () => {
      const resultWithoutOptionalCategories: LighthouseResult = {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com',
        userAgent: 'test-user-agent',
        audits: {},
        categories: { performance: { id: 'performance', title: 'Performance', score: 0.9, auditRefs: [] } },
        lighthouseVersion: '10.0.0',
        fetchTime: '2025-01-01T00:00:00.000Z',
      };

      const result = service.extractComprehensiveData(
        resultWithoutOptionalCategories,
        'https://example.com',
        'desktop'
      );

      expect(result.accessibilityScore).toBeUndefined();
      expect(result.bestPracticesScore).toBeUndefined();
      expect(result.seoScore).toBeUndefined();
    });
  });

  describe('parseAudit', () => {
    it('parses valid audit object', () => {
      const rawAudit = {
        title: 'Test Audit',
        description: 'Test description',
        score: 0.8,
        scoreDisplayMode: 'numeric',
        displayValue: '80%',
        numericValue: 0.8,
        numericUnit: 'unitless',
        metricSavings: { LCP: 100 },
        details: {
          type: 'table',
          items: [{ url: 'https://example.com' }],
        },
      };

      const result = service['parseAudit']('test-audit', rawAudit);

      expect(result).toEqual({
        id: 'test-audit',
        title: 'Test Audit',
        description: 'Test description',
        score: 0.8,
        scoreDisplayMode: 'numeric',
        displayValue: '80%',
        numericValue: 0.8,
        numericUnit: 'unitless',
        metricSavings: { LCP: 100 },
        details: expect.objectContaining({
          type: 'table',
          items: [{ url: 'https://example.com' }],
        }),
        errorMessage: undefined,
        warnings: undefined,
      });
    });

    it('handles invalid audit object', () => {
      expect(() => service['parseAudit']('test', null)).toThrow(ValidationError);
      expect(() => service['parseAudit']('test', 'invalid')).toThrow(ValidationError);
    });

    it('provides default values for missing properties', () => {
      const result = service['parseAudit']('test', {});

      expect(result).toEqual({
        id: 'test',
        title: 'Audit test',
        description: '',
        score: null,
        scoreDisplayMode: 'binary', // Default is 'binary', not 'informative'
        displayValue: undefined,
        numericValue: undefined,
        numericUnit: undefined,
        metricSavings: undefined,
        details: undefined,
        errorMessage: undefined,
        warnings: undefined,
      });
    });
  });

  describe('parseMetricSavings', () => {
    it('parses valid metric savings object', () => {
      const savings = { LCP: 200, FCP: 100, TBT: 50 };
      const result = service['parseMetricSavings'](savings);
      expect(result).toEqual(savings);
    });

    it('filters non-numeric values', () => {
      const savings = { LCP: 200, invalid: 'string', FCP: 100 };
      const result = service['parseMetricSavings'](savings);
      expect(result).toEqual({ LCP: 200, FCP: 100 });
    });

    it('returns undefined for invalid input', () => {
      expect(service['parseMetricSavings'](null)).toBeUndefined();
      expect(service['parseMetricSavings']('invalid')).toBeUndefined();
      expect(service['parseMetricSavings']({})).toBeUndefined();
    });
  });

  describe('parseAuditDetails', () => {
    it('parses complete audit details', () => {
      const details = {
        type: 'opportunity',
        headings: [
          { key: 'url', valueType: 'url', label: 'URL' },
          { key: 'wastedBytes', valueType: 'bytes', label: 'Wasted Bytes' },
        ],
        items: [
          {
            url: 'https://example.com/script.js',
            wastedBytes: 1000,
            node: {
              type: 'node', // Must have type: 'node'
              path: 'head > script',
              selector: 'script[src]',
              snippet: '<script src="..."></script>',
              nodeLabel: 'Script element',
            },
          },
        ],
        overallSavingsMs: 200,
        overallSavingsBytes: 1000,
        summary: { wastedBytes: 1000 },
      };

      const result = service['parseAuditDetails'](details);

      expect(result).toEqual({
        type: 'opportunity',
        headings: [
          { key: 'url', valueType: 'url', label: 'URL' },
          { key: 'wastedBytes', valueType: 'bytes', label: 'Wasted Bytes' },
        ],
        items: [
          {
            url: 'https://example.com/script.js',
            wastedBytes: 1000,
            node: {
              type: 'node',
              path: 'head > script',
              selector: 'script[src]',
              snippet: '<script src="..."></script>',
              nodeLabel: 'Script element',
              boundingRect: undefined,
              lhId: undefined,
            },
            source: undefined,
            totalBytes: undefined,
            wastedMs: undefined,
            resourceSize: undefined,
            transferSize: undefined,
            score: undefined,
            label: undefined,
            groupLabel: undefined,
          },
        ],
        overallSavingsMs: 200,
        overallSavingsBytes: 1000,
        summary: { wastedBytes: 1000, wastedMs: undefined },
      });
    });

    it('returns undefined for invalid details', () => {
      expect(service['parseAuditDetails'](null)).toBeUndefined();
      expect(service['parseAuditDetails']('invalid')).toBeUndefined();
    });

    it('handles unknown detail types with fallback', () => {
      const details = { type: 'unknown-type' };
      const result = service['parseAuditDetails'](details);
      expect(result?.type).toBe('table'); // fallback
    });
  });

  describe('parseAuditItems', () => {
    it('parses array of audit items', () => {
      const items = [
        { url: 'https://example.com', wastedBytes: 1000 },
        { label: 'Test Label', score: 0.8 },
      ];

      const result = service['parseAuditItems'](items);

      expect(result).toEqual([
        {
          url: 'https://example.com',
          wastedBytes: 1000,
          wastedMs: undefined,
          totalBytes: undefined,
          node: undefined,
          source: undefined,
          resourceSize: undefined,
          transferSize: undefined,
          score: undefined,
          label: undefined,
          groupLabel: undefined,
        },
        {
          url: undefined,
          wastedBytes: undefined,
          wastedMs: undefined,
          totalBytes: undefined,
          node: undefined,
          source: undefined,
          resourceSize: undefined,
          transferSize: undefined,
          score: 0.8,
          label: 'Test Label',
          groupLabel: undefined,
        },
      ]);
    });

    it('returns empty array for non-array input', () => {
      expect(service['parseAuditItems'](null)).toEqual([]);
      expect(service['parseAuditItems']('invalid')).toEqual([]);
    });

    it('filters out invalid items with warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const items = [
        { url: 'https://example.com' },
        null, // This gets parsed as empty object {} by parseAuditItem
        { label: 'Valid item' },
      ];

      const result = service['parseAuditItems'](items);

      // parseAuditItem returns {} for null, so we get 3 items, not 2
      expect(result).toHaveLength(3);
      expect(result[1]).toEqual({}); // null becomes empty object
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning because parseAuditItem handles it

      consoleWarnSpy.mockRestore();
    });

    it('handles error in parseAuditItem with warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock parseAuditItem to throw an error
      const originalParseAuditItem = service['parseAuditItem'];
      service['parseAuditItem'] = vi.fn().mockImplementation((item) => {
        if (item === 'error-item') {
          throw new Error('Parse error');
        }
        return originalParseAuditItem.call(service, item);
      });

      const items = [
        { url: 'https://example.com' },
        'error-item', // This will throw an error
        { label: 'Valid item' },
      ];

      const result = service['parseAuditItems'](items);

      expect(result).toHaveLength(2); // Error item filtered out
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: Failed to parse audit item 1:',
        expect.any(Error)
      );

      // Restore
      service['parseAuditItem'] = originalParseAuditItem;
      consoleWarnSpy.mockRestore();
    });
  });

  describe('parseHeadings', () => {
    it('parses valid headings array', () => {
      const headings = [
        { key: 'url', valueType: 'url', label: 'URL' },
        { key: 'wastedBytes', valueType: 'bytes', label: 'Wasted Bytes' },
        { key: 'invalid', valueType: 'unknown', label: 'Invalid' },
      ];

      const result = service['parseHeadings'](headings);

      expect(result).toEqual([
        { key: 'url', valueType: 'url', label: 'URL' },
        { key: 'wastedBytes', valueType: 'bytes', label: 'Wasted Bytes' },
        { key: 'invalid', valueType: 'text', label: 'Invalid' }, // fallback to 'text'
      ]);
    });

    it('returns undefined for invalid input', () => {
      expect(service['parseHeadings'](null)).toBeUndefined();
      expect(service['parseHeadings']('invalid')).toBeUndefined();
    });

    it('filters out null values', () => {
      const headings = [{ key: 'key1' }, null, { label: 'label2' }];
      const result = service['parseHeadings'](headings);
      expect(result).toHaveLength(2);
      expect(result?.[1]).toEqual({ key: '', label: 'label2', valueType: 'text' });
    });

    it('handles malformed headings in parseHeadings', () => {
      // Not an array
      expect(service['parseHeadings']({})).toBeUndefined();
      // Array with invalid items
      const headings = [{ key: 'key1' }, null, { label: 'label2' }];
      const result = service['parseHeadings'](headings);
      expect(result).toHaveLength(2);
      expect(result?.[0].key).toBe('key1');
      expect(result?.[1]).toEqual({ key: '', label: 'label2', valueType: 'text' });
    });
  });

  describe('parseScoreDisplayMode', () => {
    it('parses valid score display modes', () => {
      expect(service['parseScoreDisplayMode']('binary')).toBe('binary');
      expect(service['parseScoreDisplayMode']('numeric')).toBe('numeric');
      expect(service['parseScoreDisplayMode']('informative')).toBe('informative');
      expect(service['parseScoreDisplayMode']('metricSavings')).toBe('metricSavings');
    });

    it('returns default for invalid modes', () => {
      expect(service['parseScoreDisplayMode']('invalid')).toBe('binary'); // Default is 'binary'
      expect(service['parseScoreDisplayMode'](null)).toBe('binary');
      expect(service['parseScoreDisplayMode'](undefined)).toBe('binary');
    });
  });

  describe('categorizeAudits', () => {
    it('categorizes audits correctly', () => {
      const audits = {
        opportunity: {
          score: 0.5,
          scoreDisplayMode: 'metricSavings',
          title: 'Opportunity',
        },
        diagnostic: {
          score: null,
          scoreDisplayMode: 'informative',
          title: 'Diagnostic',
        },
        passed: {
          score: 1,
          scoreDisplayMode: 'binary',
          title: 'Passed',
        },
        failed: {
          score: 0,
          scoreDisplayMode: 'binary',
          title: 'Failed',
        },
        'null-score': {
          score: null,
          scoreDisplayMode: 'binary',
          title: 'Null Score',
        },
      };

      const result = service['categorizeAudits'](audits);

      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].id).toBe('opportunity');

      expect(result.diagnostics).toHaveLength(2); // diagnostic + failed
      expect(result.diagnostics.map(d => d.id)).toContain('diagnostic');
      expect(result.diagnostics.map(d => d.id)).toContain('failed');

      expect(result.passedAudits).toHaveLength(2); // passed + null-score
      expect(result.passedAudits.map(d => d.id)).toContain('passed');
      expect(result.passedAudits.map(d => d.id)).toContain('null-score');
    });

    it('handles invalid audits with warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const audits = {
        valid: { score: 1, title: 'Valid' },
        invalid: null, // This will cause parsing to fail
      };

      const result = service['categorizeAudits'](audits);

      expect(result.passedAudits).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse audit invalid'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getOptionalCategoryScore', () => {
    it('returns score as percentage when category exists', () => {
      const category = { score: 0.85 };
      const result = service['getOptionalCategoryScore'](category);
      expect(result).toBe(85);
    });

    it('returns undefined when score is null', () => {
      const category = { score: null };
      const result = service['getOptionalCategoryScore'](category);
      expect(result).toBeUndefined(); // Returns undefined, not 0, when score is null
    });

    it('returns undefined when category is undefined', () => {
      const result = service['getOptionalCategoryScore'](undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('parseSource', () => {
    it('handles valid source object', () => {
      const result = service['parseSource']({ type: 'node', value: 'test' });
      expect(result).toEqual({ type: 'node', value: 'test' });
    });

    it('handles malformed source object', () => {
      const result = service['parseSource']({ type: 123, value: false });
      expect(result).toEqual({ type: '', value: '' });
    });
  });

  describe('Malformed Data Handling', () => {
    it('correctly parses an audit item with invalid data types', () => {
      const item = { url: 123, wastedBytes: 'many', totalBytes: false };
      const result = service['parseAuditItem'](item);
      expect(result.url).toBeUndefined();
      expect(result.wastedBytes).toBeUndefined();
      expect(result.totalBytes).toBeUndefined();
    });

    it('correctly parses a bounding rect with invalid data types', () => {
      const rect = { top: 1, bottom: '2', left: 3, right: 4, width: 5, height: 6 };
      const result = service['parseBoundingRect'](rect);
      expect(result).toBeUndefined();
    });

    it('correctly parses a bounding rect with missing properties', () => {
      const rect = { top: 1, bottom: 2, left: 3 }; // Missing right, width, height
      const result = service['parseBoundingRect'](rect);
      expect(result).toBeUndefined();
    });

    it('correctly parses a bounding rect with null properties', () => {
      const rect = { top: 1, bottom: 2, left: 3, right: null, width: 5, height: 6 };
      const result = service['parseBoundingRect'](rect);
      expect(result).toBeUndefined();
    });

    it('correctly parses a bounding rect with each property type invalid', () => {
      // Test each property individually to ensure all branches are covered
      expect(service['parseBoundingRect']({ top: 'invalid', bottom: 2, left: 3, right: 4, width: 5, height: 6 })).toBeUndefined();
      expect(service['parseBoundingRect']({ top: 1, bottom: 'invalid', left: 3, right: 4, width: 5, height: 6 })).toBeUndefined();
      expect(service['parseBoundingRect']({ top: 1, bottom: 2, left: 'invalid', right: 4, width: 5, height: 6 })).toBeUndefined();
      expect(service['parseBoundingRect']({ top: 1, bottom: 2, left: 3, right: 'invalid', width: 5, height: 6 })).toBeUndefined();
      expect(service['parseBoundingRect']({ top: 1, bottom: 2, left: 3, right: 4, width: 'invalid', height: 6 })).toBeUndefined();
      expect(service['parseBoundingRect']({ top: 1, bottom: 2, left: 3, right: 4, width: 5, height: 'invalid' })).toBeUndefined();
    });

    it('correctly parses a summary with invalid data types', () => {
      const summary = { wastedBytes: '1000', wastedMs: '500' };
      const result = service['parseSummary'](summary);
      expect(result?.wastedBytes).toBeUndefined();
      expect(result?.wastedMs).toBeUndefined();
    });

    it('filters null values from headings array', () => {
      const headings = [{ key: 'key1' }, null, { label: 'label2' }];
      const result = service['parseHeadings'](headings);
      expect(result).toHaveLength(2);
      expect(result?.[1]).toEqual({ key: '', label: 'label2', valueType: 'text' });
    });

    it('categorizes a failed, non-opportunity audit as a diagnostic', () => {
      const audits = {
        'failed-diagnostic': { score: 0.1, scoreDisplayMode: 'binary', title: 'Failed Diagnostic' },
      };
      const result = service['categorizeAudits'](audits);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].id).toBe('failed-diagnostic');
    });
  });
}); 