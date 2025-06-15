import { describe, it, expect } from 'vitest';
import { auditExtractor } from '../../src/services/auditExtractor.js';
import type { PsiAuditItem } from '../../src/types/psi.js';

// Utility type to expose the private methods we want to test via casting
// This avoids the use of the `any` type while still allowing access.
type AuditExtractorPrivate = {
  parseAuditItem: (item: unknown) => PsiAuditItem;
  parseSummary: (
    summary: unknown
  ) => {
    wastedBytes?: number;
    wastedMs?: number;
  } | undefined;
  parseDOMElement: (
    node: unknown
  ) => {
    type: 'node';
    path: string;
    selector: string;
    snippet: string;
    nodeLabel: string;
  } | undefined;
};

// Cast the public singleton instance to the private interface
const extractor = auditExtractor as unknown as AuditExtractorPrivate;

describe('AuditExtractorService – internal parsers', () => {
  it('correctly parses a fully-populated audit item including DOM element and bounding rect', () => {
    const sampleItem = {
      url: 'https://example.com/script.js',
      wastedBytes: 2048,
      wastedMs: 150,
      totalBytes: 4096,
      node: {
        type: 'node',
        path: '/html[1]/body[1]/div[1]',
        selector: 'div#main',
        snippet: '<div id="main">…</div>',
        nodeLabel: 'div',
        boundingRect: {
          top: 10,
          bottom: 20,
          left: 30,
          right: 40,
          width: 300,
          height: 200,
        },
        lhId: 'node-1',
      },
      source: {
        type: 'url',
        value: 'https://cdn.example.com/script.js',
      },
      resourceSize: 4096,
      transferSize: 2048,
      score: 0.5,
      label: 'Example script',
      groupLabel: 'Scripts',
    };

    const parsed = extractor.parseAuditItem(sampleItem);

    // Basic shape assertions
    expect(parsed.url).toBe(sampleItem.url);
    expect(parsed.wastedBytes).toBe(sampleItem.wastedBytes);
    expect(parsed.node).toBeDefined();
    expect(parsed.node?.type).toBe('node');
    expect(parsed.node?.boundingRect).toEqual(sampleItem.node.boundingRect);
    expect(parsed.source?.type).toBe('url');
    expect(parsed.transferSize).toBe(2048);
  });

  it('handles empty summary object by returning an object with undefined fields', () => {
    const summary = {};
    const parsedSummary = extractor.parseSummary(summary);
    expect(parsedSummary).toEqual({ wastedBytes: undefined, wastedMs: undefined });
  });

  it('parses summary object with wastedBytes and wastedMs', () => {
    const summary = { wastedBytes: 1234, wastedMs: 567 };
    const parsedSummary = extractor.parseSummary(summary);
    expect(parsedSummary).toEqual(summary);
  });

  it('falls back to empty strings when DOM element fields are invalid', () => {
    const malformedNode = {
      type: 'node',
      path: 123,
      selector: false,
      snippet: null,
      nodeLabel: undefined,
    } as unknown;

    const parsed = extractor.parseDOMElement(malformedNode);

    expect(parsed).toBeDefined();
    expect(parsed?.path).toBe('');
    expect(parsed?.selector).toBe('');
    expect(parsed?.snippet).toBe('');
    expect(parsed?.nodeLabel).toBe('');
  });
}); 