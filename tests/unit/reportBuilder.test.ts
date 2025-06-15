import { describe, it, expect } from 'vitest';

import { buildMarkdownReport, appendAiSummary, formatBytes, buildComprehensiveMarkdownReport } from '../../src/utils/reportBuilder.js';
import { AppConfig } from '../../src/config/index.js';
import { MedianResult, ComprehensivePsiData } from '../../src/types/psi.js';

const cfg: AppConfig = {
  apiKey: 'dummy',
  urls: ['https://example.com'],
  strategies: ['desktop'],
  concurrency: 1,
  runsPerUrl: 1,
  cfgPath: 'urls.yml',
  detailedReport: false,
  ai: { enabled: false, model: 'gpt-3.5-turbo' },
};

// Mock audit data for testing
const mockAuditData: ComprehensivePsiData = {
  url: 'https://example.com',
  strategy: 'desktop',
  performanceScore: 90,
  metrics: {
    lcp: 2000,
    fcp: 1000,
    cls: 0.05,
    tbt: 100,
    si: 1500,
  },
  opportunities: [
    {
      id: 'unused-css-rules',
      title: 'Remove unused CSS',
      description: 'Remove dead rules from stylesheets.',
      score: 0.3,
      scoreDisplayMode: 'metricSavings',
      displayValue: 'Potential savings of 1,024 KiB',
      metricSavings: { LCP: 200, FCP: 100 },
      details: {
        type: 'opportunity',
        items: [
          {
            url: 'https://example.com/styles.css',
            wastedBytes: 1048576,
            totalBytes: 2097152,
          },
        ],
        headings: [
          { key: 'url', valueType: 'url', label: 'URL' },
          { key: 'wastedBytes', valueType: 'bytes', label: 'Wasted Bytes' },
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
      scoreDisplayMode: 'informative',
      displayValue: '1,500 elements',
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              path: 'body > div.container',
              selector: 'body > div.container',
              snippet: '<div class="container">...</div>',
              nodeLabel: 'Container div',
            },
            score: 0.8,
          },
        ],
        headings: [
          { key: 'node', valueType: 'node', label: 'Element' },
          { key: 'score', valueType: 'text', label: 'Score' },
        ],
      },
    },
  ],
  passedAudits: [
    {
      id: 'first-contentful-paint',
      title: 'First Contentful Paint',
      description: 'Fast FCP helps ensure users feel like the page is loading.',
      score: 1,
      scoreDisplayMode: 'numeric',
      displayValue: '1.0 s',
    },
  ],
  lighthouseVersion: '10.0.0',
  fetchTime: '2025-01-01T00:00:00.000Z',
};

const medianResults: MedianResult[] = [
  {
    url: 'https://example.com',
    strategy: 'desktop',
    runs: 1,
    medianScore: 90,
    medianLcp: 2000,
    medianFcp: 1000,
    medianCls: 0.05,
    medianTbt: 100,
    individualRuns: [],
    auditData: mockAuditData,
  },
];

describe('utils/reportBuilder.buildMarkdownReport', () => {
  it('returns correctly formatted markdown', () => {
    const md = buildMarkdownReport(cfg, medianResults, 'Testing 1 URL × 1 strategy × 1 run', 'Started at TEST_DATE');

    expect(md).toMatchInlineSnapshot(`
"# InsightsAI Analysis

Testing 1 URL × 1 strategy × 1 run
Started at TEST_DATE

## Legend

- 🟢 Good: Performance meets or exceeds recommended thresholds
- 🟡 Needs Improvement: Performance is below recommended thresholds but not critical
- 🔴 Poor: Performance is significantly below recommended thresholds

## Final Results (Medians)

| URL | Strategy | Runs | Score | LCP | FCP | CLS | TBT |
| :-- | :------: | :--: | ----: | --: | --: | --: | --: |
| https://example.com | desktop | 1 | 🟢 <sub>90</sub> | 🟢 <sub>2s</sub> | 🟢 <sub>1s</sub> | 🟢 <sub>0.050</sub> | 🟢 <sub>100ms</sub> |
"
    `);
  });

  it('handles zero values correctly', () => {
    const zeroResults: MedianResult[] = [
      {
        url: 'https://example.com',
        strategy: 'desktop',
        runs: 1,
        medianScore: 0,
        medianLcp: 0,
        medianFcp: 0,
        medianCls: 0,
        medianTbt: 0,
        individualRuns: [],
        auditData: { ...mockAuditData, performanceScore: 0 },
      },
    ];

    const md = buildMarkdownReport(cfg, zeroResults, 'Testing with zeros', 'Started at TEST_DATE');

    // Check that zero values are formatted as 'n/a' for LCP, FCP, and TBT metrics
    // CLS is handled differently with toFixed(3) so it shows as 0.000
    expect(md).toContain('<sub>n/a</sub>');
    expect(md).toContain('<sub>0.000</sub>');
    
    // Specifically test that LCP, FCP, and TBT show 'n/a' when zero
    const lines = md.split('\n');
    const dataLine = lines.find(line => line.includes('https://example.com'));
    expect(dataLine).toBeDefined();
    expect(dataLine).toMatch(/<sub>n\/a<\/sub>.*<sub>n\/a<\/sub>.*<sub>0\.000<\/sub>.*<sub>n\/a<\/sub>/); // LCP n/a, FCP n/a, CLS 0.000, TBT n/a
  });
});

describe('utils/reportBuilder.appendAiSummary', () => {
  it('appendAiSummary returns original content when summarySection is empty', () => {
    const original = '# Report';
    const result = appendAiSummary(original, '   ');
    expect(result).toBe(original);
  });

  it('appendAiSummary appends formatted summary when non-empty', () => {
    const original = '# Report';
    const summary = '**Overview**: Good';
    const expected = `${original}\n\n## AI Summary\n\n${summary}\n`;
    const result = appendAiSummary(original, summary);
    expect(result).toBe(expected);
  });
});

describe('utils/reportBuilder.formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('handles large numbers correctly', () => {
    expect(formatBytes(2560000)).toBe('2.44 MB');
    expect(formatBytes(5000000000)).toBe('4.66 GB');
  });
});

describe('utils/reportBuilder.buildComprehensiveMarkdownReport', () => {
  it('builds comprehensive report with audit details', () => {
    const result = buildComprehensiveMarkdownReport(
      cfg,
      medianResults,
      'Testing comprehensive report',
      'Started at TEST_DATE'
    );

    // Should include basic report content
    expect(result).toContain('# InsightsAI Analysis');
    expect(result).toContain('Testing comprehensive report');
    expect(result).toContain('Final Results (Medians)');

    // Should include detailed analysis sections
    expect(result).toContain('## Detailed Analysis: https://example.com (desktop)');
    expect(result).toContain('### ⚡ Performance Opportunities');
    expect(result).toContain('### 🔍 Diagnostics');
    expect(result).toContain('### ✅ Passed Audits');

    // Should include opportunity details
    expect(result).toContain('#### Remove unused CSS');
    expect(result).toContain('Remove dead rules from stylesheets.');
    expect(result).toContain('**Potential savings:** Potential savings of 1,024 KiB');
    expect(result).toContain('**Metric improvements:** LCP: 200ms, FCP: 100ms');

    // Should include diagnostic details
    expect(result).toContain('#### Avoid an excessive DOM size');
    expect(result).toContain('A large DOM will increase memory usage.');
    expect(result).toContain('**Value:** 1,500 elements');

    // Should include passed audits
    expect(result).toContain('First Contentful Paint');
    expect(result).toContain('(1.0 s)');
  });

  it('handles empty opportunities gracefully', () => {
    const emptyAuditData = { ...mockAuditData, opportunities: [] };
    const emptyResults = [{ ...medianResults[0], auditData: emptyAuditData }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      emptyResults,
      'Testing empty opportunities',
      'Started at TEST_DATE'
    );

    expect(result).toContain('### 🟢 Performance Opportunities');
    expect(result).toContain('No significant optimization opportunities identified.');
  });

  it('handles empty diagnostics gracefully', () => {
    const emptyAuditData = { ...mockAuditData, diagnostics: [] };
    const emptyResults = [{ ...medianResults[0], auditData: emptyAuditData }];

    const result = buildComprehensiveMarkdownReport(
      cfg,    
      emptyResults,
      'Testing empty diagnostics',
      'Started at TEST_DATE'
    );

    expect(result).toContain('### 🔍 Diagnostics');
    expect(result).toContain('No significant diagnostic issues found.');
  });

  it('handles resource table rendering', () => {
    const result = buildComprehensiveMarkdownReport(
      cfg,
      medianResults,
      'Testing resource table',
      'Started at TEST_DATE'
    );

    // Should render resource table for opportunities
    expect(result).toContain('| Resource | Size | Potential Savings |');
    expect(result).toContain('| :-- | --: | --: |');
    expect(result).toContain('| `/styles.css` | 2 MB | 1 MB |');
  });

  it('handles DOM element rendering', () => {
    const result = buildComprehensiveMarkdownReport(
      cfg,
      medianResults,
      'Testing DOM elements',
      'Started at TEST_DATE'
    );

    // Should render DOM elements for diagnostics
    expect(result).toContain('- **Element:** `body > div.container`');
    expect(result).toContain('- **Code:** `<div class="container">...</div>`');
    expect(result).toContain('- **Impact:** 0.8');
  });

  it('limits opportunities and diagnostics to reasonable counts', () => {
    // Create audit data with many opportunities and diagnostics
    const manyOpportunities = Array.from({ length: 15 }, (_, i) => ({
      id: `opportunity-${i}`,
      title: `Opportunity ${i}`,
      description: `Description ${i}`,
      score: 0.5,
      scoreDisplayMode: 'metricSavings' as const,
      displayValue: `Save ${i * 100}ms`,
    }));

    const manyDiagnostics = Array.from({ length: 12 }, (_, i) => ({
      id: `diagnostic-${i}`,
      title: `Diagnostic ${i}`,
      description: `Description ${i}`,
      score: null,
      scoreDisplayMode: 'informative' as const,
      displayValue: `${i} issues`,
    }));

    const manyAuditData = {
      ...mockAuditData,
      opportunities: manyOpportunities,
      diagnostics: manyDiagnostics,
    };

    const manyResults = [{ ...medianResults[0], auditData: manyAuditData }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      manyResults,
      'Testing limits',
      'Started at TEST_DATE'
    );

    // Should only show first 10 opportunities
    expect(result).toContain('#### Opportunity 0');
    expect(result).toContain('#### Opportunity 9');
    expect(result).not.toContain('#### Opportunity 10');

    // Should only show first 8 diagnostics
    expect(result).toContain('#### Diagnostic 0');
    expect(result).toContain('#### Diagnostic 7');
    expect(result).not.toContain('#### Diagnostic 8');
  });

  it('handles missing audit details gracefully', () => {
    const auditDataWithoutDetails = {
      ...mockAuditData,
      opportunities: [
        {
          id: 'test-opportunity',
          title: 'Test Opportunity',
          description: 'Test description',
          score: 0.5,
          scoreDisplayMode: 'metricSavings' as const,
          displayValue: 'Save 200ms',
          // No details property
        },
      ],
    };

    const resultsWithoutDetails = [{ ...medianResults[0], auditData: auditDataWithoutDetails }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      resultsWithoutDetails,
      'Testing missing details',
      'Started at TEST_DATE'
    );

    expect(result).toContain('#### Test Opportunity');
    expect(result).toContain('Test description');
    expect(result).toContain('**Potential savings:** Save 200ms');
  });

  it('handles invalid URLs in resource tables gracefully', () => {
    const auditDataWithInvalidUrl = {
      ...mockAuditData,
      opportunities: [
        {
          id: 'test-opportunity',
          title: 'Test Opportunity',
          description: 'Test description',
          score: 0.5,
          scoreDisplayMode: 'metricSavings' as const,
          details: {
            type: 'opportunity' as const,
            items: [
              {
                url: 'invalid-url-format', // This will cause URL constructor to fail
                wastedBytes: 1000,
                totalBytes: 2000,
              },
            ],
                         headings: [
               { key: 'url', valueType: 'url' as const, label: 'URL' },
             ],
          },
        },
      ],
    };

    const resultsWithInvalidUrl = [{ ...medianResults[0], auditData: auditDataWithInvalidUrl }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      resultsWithInvalidUrl,
      'Testing invalid URL',
      'Started at TEST_DATE'
    );

    // Should handle invalid URL gracefully by falling back to original string
    expect(result).toContain('| `invalid-url-format` | 1.95 KB | 1000 B |');
  });

  it('handles long snippets in element lists', () => {
    const auditDataWithLongSnippet = {
      ...mockAuditData,
      diagnostics: [
        {
          id: 'test-diagnostic',
          title: 'Test Diagnostic',
          description: 'Test description',
          score: null,
          scoreDisplayMode: 'informative' as const,
          details: {
            type: 'table' as const,
            items: [
              {
                node: {
                  type: 'node' as const,
                  path: 'body > div',
                  selector: 'div.test',
                  snippet: 'a'.repeat(150), // Very long snippet that should be truncated
                  nodeLabel: 'Test element',
                },
                score: 0.5,
              },
            ],
                         headings: [
               { key: 'node', valueType: 'node' as const, label: 'Element' },
             ],
          },
        },
      ],
    };

    const resultsWithLongSnippet = [{ ...medianResults[0], auditData: auditDataWithLongSnippet }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      resultsWithLongSnippet,
      'Testing long snippet',
      'Started at TEST_DATE'
    );

    // Should truncate long snippets with "..."
    expect(result).toContain('- **Code:** `' + 'a'.repeat(100) + '...`');
    expect(result).toContain('- **Impact:** 0.5');
  });

  it('handles items with only labels in simple list', () => {
    const auditDataWithLabelItems = {
      ...mockAuditData,
      opportunities: [
        {
          id: 'test-opportunity',
          title: 'Test Opportunity',
          description: 'Test description',
          score: 0.5,
          scoreDisplayMode: 'metricSavings' as const,
          details: {
            type: 'table' as const,
            items: [
              { label: 'First item' },
              { url: 'https://example.com/resource.js' }, // Has URL but no bytes/ms, so uses simple list
              { label: 'Third item' },
            ],
                         headings: [
               { key: 'label', valueType: 'text' as const, label: 'Item' },
             ],
          },
        },
      ],
    };

    const resultsWithLabelItems = [{ ...medianResults[0], auditData: auditDataWithLabelItems }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      resultsWithLabelItems,
      'Testing simple list',
      'Started at TEST_DATE'
    );

    // Should render as simple list when no bytes/ms data available
    expect(result).toContain('- First item');
    expect(result).toContain('- https://example.com/resource.js');
    expect(result).toContain('- Third item');
  });

  it('handles empty passed audits section', () => {
    const auditDataWithoutPassedAudits = {
      ...mockAuditData,
      passedAudits: [],
    };

    const resultsWithoutPassedAudits = [{ ...medianResults[0], auditData: auditDataWithoutPassedAudits }];

    const result = buildComprehensiveMarkdownReport(
      cfg,
      resultsWithoutPassedAudits,
      'Testing empty passed audits',
      'Started at TEST_DATE'
    );

    // Should not include passed audits section when empty
    expect(result).not.toContain('### ✅ Passed Audits');
  });

  describe('handles missing data in audit items', () => {
    it('renders resource table with missing size and ms savings', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://a.com/s.css', wastedMs: 250 }, // No totalBytes, has wastedMs
              { url: 'https://b.com/s.js' }, // No savings info
            ],
            headings: [],
          },
        }],
      };
      const results = [{ ...medianResults[0], auditData }];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');

      expect(report).toContain('| `/s.css` | n/a | 250ms |');
      expect(report).toContain('| `/s.js` | n/a | n/a |');
    });

    it('renders element list with missing snippet or score', () => {
      const auditData = {
        ...mockAuditData,
        diagnostics: [{
          ...mockAuditData.diagnostics[0],
          details: {
            type: 'table' as const,
            items: [
              // No snippet/score (but snippet is required, so it's an empty string)
              { node: { type: 'node' as const, selector: 'div.no-snippet', path: '', nodeLabel: '', snippet: '' } },
              // No score
              { node: { type: 'node' as const, selector: 'div.no-score', snippet: '<p></p>', path: '', nodeLabel: '' } },
            ],
            headings: [],
          },
        }],
      };
      const results = [{ ...medianResults[0], auditData }];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');

      // Isolate the diagnostics section
      const diagnosticsSection = report.split('### 🔍 Diagnostics')[1].split('### ✅ Passed Audits')[0];

      // Find the line with the no-snippet element
      const lines = diagnosticsSection.split('\n');
      const noSnippetLineIndex = lines.findIndex(line => line.includes('div.no-snippet'));
      const noScoreLineIndex = lines.findIndex(line => line.includes('div.no-score'));

      // Check that there is no '**Code:**' line between the two elements
      let hasCodeLine = false;
      for (let i = noSnippetLineIndex + 1; i < noScoreLineIndex; i++) {
        if (lines[i].includes('**Code:**')) {
          hasCodeLine = true;
          break;
        }
      }
      expect(hasCodeLine).toBe(false);

      // Check that the no-score element DOES have a code line
      expect(lines[noScoreLineIndex + 1]).toContain('**Code:**');
    });

    it('renders simple list with items that have no label or url', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'table' as const,
            items: [
              { label: 'Item 1' },
              {}, // Empty item
              { url: 'https://example.com' },
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      // The empty item should not produce a line
      expect(report).toContain('- Item 1');
      expect(report).toContain('- https://example.com');
      const lines = report.split('\n');
      const simpleListLines = lines.filter(l => l.startsWith('- '));
      // Only two lines should be generated from the simple list
      expect(simpleListLines.filter(l => l.includes('Item 1') || l.includes('https://example.com'))).toHaveLength(2);
    });

    it('renders passed audits without a display value', () => {
      const auditData = {
        ...mockAuditData,
        passedAudits: [{
          id: 'passed-1',
          title: 'A Passed Audit Without Display Value',
          description: '', // Required property
          score: 1,
          scoreDisplayMode: 'binary' as const,
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      expect(report).toContain('- **A Passed Audit Without Display Value**');
      // Ensure no empty parens are added
      expect(report).not.toContain('()');
    });

    it('handles invalid URLs in resource table with fallback', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'invalid-url-format', wastedBytes: 1000 }, // Invalid URL that will throw
              { url: 'https://example.com/valid.js', totalBytes: 2000 },
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      
      // Should fall back to original URL when URL constructor throws
      expect(report).toContain('| `invalid-url-format` |');
      expect(report).toContain('| `/valid.js` |');
    });

    it('handles items with only wastedBytes (no totalBytes)', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/file.js', wastedBytes: 1000 }, // Only wastedBytes
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      
      expect(report).toContain('| `/file.js` | n/a | 1000 B |');
    });

    it('handles items with only totalBytes (no wastedBytes)', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/file.js', totalBytes: 2000 }, // Only totalBytes
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      
      expect(report).toContain('| `/file.js` | 1.95 KB | n/a |');
    });

    it('handles element list with items that have no node', () => {
      const auditData = {
        ...mockAuditData,
        diagnostics: [{
          ...mockAuditData.diagnostics[0],
          details: {
            type: 'table' as const,
            items: [
              { node: { type: 'node' as const, selector: 'div.valid', snippet: '<div></div>', path: '', nodeLabel: '' } },
              { score: 0.5 }, // No node property
              { label: 'Some item' }, // No node property
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      
      // Should only render the item with a node
      expect(report).toContain('- **Element:** `div.valid`');
      // Items without nodes should not appear in element list
      const elementLines = report.split('\n').filter(line => line.includes('**Element:**'));
      expect(elementLines).toHaveLength(1);
    });

    it('handles items with wastedBytes but no totalBytes to trigger hasBytes branch', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/file1.js', wastedBytes: 1000 }, // Has wastedBytes, no totalBytes
              { url: 'https://example.com/file2.js' }, // No bytes info
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      
      // Should render as resource table because hasBytes is true (wastedBytes exists)
      expect(report).toContain('| Resource | Size | Potential Savings |');
      expect(report).toContain('| `/file1.js` | n/a | 1000 B |');
    });

    it('handles items with totalBytes but no wastedBytes to trigger hasBytes branch', () => {
      const auditData = {
        ...mockAuditData,
        opportunities: [{
          ...mockAuditData.opportunities[0],
          details: {
            type: 'opportunity' as const,
            items: [
              { url: 'https://example.com/file1.js', totalBytes: 2000 }, // Has totalBytes, no wastedBytes
              { url: 'https://example.com/file2.js' }, // No bytes info
            ],
            headings: [],
          },
        }],
      };
      const results = [{...medianResults[0], auditData}];
      const report = buildComprehensiveMarkdownReport(cfg, results, '', '');
      
      // Should render as resource table because hasBytes is true (totalBytes exists)
      expect(report).toContain('| Resource | Size | Potential Savings |');
      expect(report).toContain('| `/file1.js` | 1.95 KB | n/a |');
    });
  });
}); 