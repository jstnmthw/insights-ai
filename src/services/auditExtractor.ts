import { ValidationError } from '../errors/index.js';
import type {
  LighthouseResult,
  ComprehensivePsiData,
  PsiAudit,
  PsiAuditDetails,
  PsiAuditItem,
  DOMElement,
} from '../types/psi.js';

/**
 * Service responsible for extracting and processing comprehensive audit data
 * from Lighthouse results into structured, usable formats.
 */
export class AuditExtractorService {
  /**
   * Extracts comprehensive audit data from a Lighthouse result.
   *
   * @param lighthouseResult - Raw Lighthouse result from PSI API
   * @param url - The tested URL
   * @param strategy - Desktop or mobile strategy
   * @returns Processed comprehensive PSI data
   */
  public extractComprehensiveData(
    lighthouseResult: LighthouseResult,
    url: string,
    strategy: 'desktop' | 'mobile'
  ): ComprehensivePsiData {
    if (!lighthouseResult?.audits || !lighthouseResult?.categories?.performance) {
      throw new ValidationError('Invalid Lighthouse result: missing required audit data');
    }

    const audits = lighthouseResult.audits;
    const performanceCategory = lighthouseResult.categories.performance;

    // Extract core metrics
    const metrics = this.extractCoreMetrics(audits);

    // Categorize audits
    const { opportunities, diagnostics, passedAudits } = this.categorizeAudits(audits);

    return {
      url,
      strategy,
      performanceScore: Math.round((performanceCategory.score ?? 0) * 100),
      metrics,
      opportunities,
      diagnostics,
      passedAudits,
      accessibilityScore: this.getOptionalCategoryScore(lighthouseResult.categories.accessibility),
      bestPracticesScore: this.getOptionalCategoryScore(
        lighthouseResult.categories['best-practices']
      ),
      seoScore: this.getOptionalCategoryScore(lighthouseResult.categories.seo),
      lighthouseVersion: lighthouseResult.lighthouseVersion,
      fetchTime: lighthouseResult.fetchTime,
      environment: lighthouseResult.environment,
    };
  }

  /**
   * Extracts core performance metrics from audits.
   */
  private extractCoreMetrics(audits: Record<string, unknown>): ComprehensivePsiData['metrics'] {
    const getMetricValue = (auditId: string): number => {
      const audit = audits[auditId] as { numericValue?: number } | undefined;
      return audit?.numericValue ?? 0;
    };

    return {
      lcp: getMetricValue('largest-contentful-paint'),
      fcp: getMetricValue('first-contentful-paint'),
      cls: getMetricValue('cumulative-layout-shift'),
      tbt: getMetricValue('total-blocking-time'),
      si: getMetricValue('speed-index'),
      tti: getMetricValue('interactive'), // May be undefined for newer Lighthouse versions
    };
  }

  /**
   * Categorizes audits into opportunities, diagnostics, and passed audits.
   */
  private categorizeAudits(audits: Record<string, unknown>): {
    opportunities: PsiAudit[];
    diagnostics: PsiAudit[];
    passedAudits: PsiAudit[];
  } {
    const opportunities: PsiAudit[] = [];
    const diagnostics: PsiAudit[] = [];
    const passedAudits: PsiAudit[] = [];

    for (const [id, rawAudit] of Object.entries(audits)) {
      try {
        const audit = this.parseAudit(id, rawAudit);

        if (audit.scoreDisplayMode === 'metricSavings' && audit.score !== null && audit.score < 1) {
          opportunities.push(audit);
        } else if (audit.scoreDisplayMode === 'informative') {
          diagnostics.push(audit);
        } else if (audit.score === 1 || audit.score === null) {
          passedAudits.push(audit);
        } else {
          // Failed audits that aren't opportunities
          diagnostics.push(audit);
        }
      } catch (error) {
        // Log warning but don't fail entire extraction
        console.warn(`Warning: Failed to parse audit ${id}:`, error);
      }
    }

    return { opportunities, diagnostics, passedAudits };
  }

  /**
   * Parses a raw audit object into a structured PsiAudit.
   */
  private parseAudit(id: string, rawAudit: unknown): PsiAudit {
    if (!this.isValidAuditObject(rawAudit)) {
      throw new ValidationError(`Invalid audit object for ${id}`);
    }

    const audit: PsiAudit = {
      id,
      title: rawAudit.title ?? `Audit ${id}`,
      description: rawAudit.description ?? '',
      score: rawAudit.score ?? null,
      scoreDisplayMode: this.parseScoreDisplayMode(rawAudit.scoreDisplayMode),
      displayValue: rawAudit.displayValue,
      numericValue: rawAudit.numericValue,
      numericUnit: rawAudit.numericUnit,
      metricSavings: this.parseMetricSavings(rawAudit.metricSavings),
      details: this.parseAuditDetails(rawAudit.details),
      errorMessage: rawAudit.errorMessage,
      warnings: rawAudit.warnings,
    };

    return audit;
  }

  /**
   * Type guard to validate audit object structure.
   */
  private isValidAuditObject(obj: unknown): obj is {
    title?: string;
    description?: string;
    score?: number | null;
    scoreDisplayMode?: string;
    displayValue?: string;
    numericValue?: number;
    numericUnit?: string;
    metricSavings?: unknown;
    details?: unknown;
    errorMessage?: string;
    warnings?: string[];
  } {
    return typeof obj === 'object' && obj !== null;
  }

  /**
   * Parses metric savings object.
   */
  private parseMetricSavings(savings: unknown): Record<string, number> | undefined {
    if (!savings || typeof savings !== 'object') return undefined;

    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(savings as Record<string, unknown>)) {
      if (typeof value === 'number') {
        result[key] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Parses audit details object.
   */
  private parseAuditDetails(details: unknown): PsiAuditDetails | undefined {
    if (!details || typeof details !== 'object') return undefined;

    const detailsObj = details as Record<string, unknown>;

    return {
      type: this.parseDetailsType(detailsObj.type),
      headings: this.parseHeadings(detailsObj.headings),
      items: this.parseAuditItems(detailsObj.items),
      overallSavingsMs:
        typeof detailsObj.overallSavingsMs === 'number' ? detailsObj.overallSavingsMs : undefined,
      overallSavingsBytes:
        typeof detailsObj.overallSavingsBytes === 'number'
          ? detailsObj.overallSavingsBytes
          : undefined,
      summary: this.parseSummary(detailsObj.summary),
    };
  }

  /**
   * Parses details type with fallback.
   */
  private parseDetailsType(type: unknown): PsiAuditDetails['type'] {
    const validTypes = ['table', 'list', 'opportunity', 'debugdata', 'treemap-data'] as const;
    return validTypes.includes(type as (typeof validTypes)[number])
      ? (type as (typeof validTypes)[number])
      : 'table';
  }

  /**
   * Parses audit items array.
   */
  private parseAuditItems(items: unknown): PsiAuditItem[] {
    if (!Array.isArray(items)) return [];

    return items
      .map((item, index) => {
        try {
          return this.parseAuditItem(item);
        } catch (error) {
          console.warn(`Warning: Failed to parse audit item ${index}:`, error);
          return null;
        }
      })
      .filter((item): item is PsiAuditItem => item !== null);
  }

  /**
   * Parses individual audit item.
   */
  private parseAuditItem(item: unknown): PsiAuditItem {
    if (!item || typeof item !== 'object') {
      return {};
    }

    const itemObj = item as Record<string, unknown>;

    return {
      url: typeof itemObj.url === 'string' ? itemObj.url : undefined,
      wastedBytes: typeof itemObj.wastedBytes === 'number' ? itemObj.wastedBytes : undefined,
      wastedMs: typeof itemObj.wastedMs === 'number' ? itemObj.wastedMs : undefined,
      totalBytes: typeof itemObj.totalBytes === 'number' ? itemObj.totalBytes : undefined,
      node: this.parseDOMElement(itemObj.node),
      source: this.parseSource(itemObj.source),
      resourceSize: typeof itemObj.resourceSize === 'number' ? itemObj.resourceSize : undefined,
      transferSize: typeof itemObj.transferSize === 'number' ? itemObj.transferSize : undefined,
      score: typeof itemObj.score === 'number' ? itemObj.score : undefined,
      label: typeof itemObj.label === 'string' ? itemObj.label : undefined,
      groupLabel: typeof itemObj.groupLabel === 'string' ? itemObj.groupLabel : undefined,
    };
  }

  /**
   * Parses DOM element information.
   */
  private parseDOMElement(node: unknown): DOMElement | undefined {
    if (!node || typeof node !== 'object') return undefined;

    const nodeObj = node as Record<string, unknown>;

    if (nodeObj.type !== 'node') return undefined;

    return {
      type: 'node',
      path: typeof nodeObj.path === 'string' ? nodeObj.path : '',
      selector: typeof nodeObj.selector === 'string' ? nodeObj.selector : '',
      snippet: typeof nodeObj.snippet === 'string' ? nodeObj.snippet : '',
      nodeLabel: typeof nodeObj.nodeLabel === 'string' ? nodeObj.nodeLabel : '',
      boundingRect: this.parseBoundingRect(nodeObj.boundingRect),
      lhId: typeof nodeObj.lhId === 'string' ? nodeObj.lhId : undefined,
    };
  }

  /**
   * Parses bounding rectangle information.
   */
  private parseBoundingRect(rect: unknown): DOMElement['boundingRect'] {
    if (!rect || typeof rect !== 'object') return undefined;

    const rectObj = rect as Record<string, unknown>;

    if (
      typeof rectObj.top !== 'number' ||
      typeof rectObj.bottom !== 'number' ||
      typeof rectObj.left !== 'number' ||
      typeof rectObj.right !== 'number' ||
      typeof rectObj.width !== 'number' ||
      typeof rectObj.height !== 'number'
    ) {
      return undefined;
    }

    return {
      top: rectObj.top,
      bottom: rectObj.bottom,
      left: rectObj.left,
      right: rectObj.right,
      width: rectObj.width,
      height: rectObj.height,
    };
  }

  /**
   * Parses source information.
   */
  private parseSource(source: unknown): PsiAuditItem['source'] {
    if (!source || typeof source !== 'object') return undefined;

    const sourceObj = source as Record<string, unknown>;

    return {
      type: typeof sourceObj.type === 'string' ? sourceObj.type : '',
      value: typeof sourceObj.value === 'string' ? sourceObj.value : '',
    };
  }

  /**
   * Parses headings array.
   */
  private parseHeadings(headings: unknown): PsiAuditDetails['headings'] {
    if (!Array.isArray(headings)) return undefined;

    return headings
      .map((heading) => {
        if (!heading || typeof heading !== 'object') return null;
        const h = heading as Record<string, unknown>;

        return {
          key: typeof h.key === 'string' ? h.key : '',
          label: typeof h.label === 'string' ? h.label : '',
          valueType: this.parseValueType(h.valueType),
        };
      })
      .filter((h): h is NonNullable<PsiAuditDetails['headings']>[number] => h !== null);
  }

  /**
   * Parses value type with validation.
   */
  private parseValueType(valueType: unknown): 'text' | 'bytes' | 'ms' | 'url' | 'node' {
    const validTypes = ['text', 'bytes', 'ms', 'url', 'node'] as const;
    return validTypes.includes(valueType as (typeof validTypes)[number])
      ? (valueType as (typeof validTypes)[number])
      : 'text';
  }

  /**
   * Parses summary object.
   */
  private parseSummary(summary: unknown): PsiAuditDetails['summary'] {
    if (!summary || typeof summary !== 'object') return undefined;

    const summaryObj = summary as Record<string, unknown>;

    return {
      wastedBytes: typeof summaryObj.wastedBytes === 'number' ? summaryObj.wastedBytes : undefined,
      wastedMs: typeof summaryObj.wastedMs === 'number' ? summaryObj.wastedMs : undefined,
    };
  }

  /**
   * Parses score display mode with validation.
   */
  private parseScoreDisplayMode(scoreDisplayMode: unknown): PsiAudit['scoreDisplayMode'] {
    const validModes = [
      'numeric',
      'binary',
      'manual',
      'informative',
      'notApplicable',
      'error',
      'metricSavings',
    ] as const;
    return validModes.includes(scoreDisplayMode as (typeof validModes)[number])
      ? (scoreDisplayMode as (typeof validModes)[number])
      : 'binary';
  }

  /**
   * Gets optional category score.
   */
  private getOptionalCategoryScore(
    category: { score: number | null } | undefined
  ): number | undefined {
    if (!category || category.score === null) return undefined;
    return Math.round(category.score * 100);
  }
}

/**
 * Singleton instance for audit extraction.
 */
export const auditExtractor = new AuditExtractorService();
