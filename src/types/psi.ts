export interface Metric {
  display: string;
  numeric: number;
}

export interface RunResult {
  url: string;
  strategy: 'desktop' | 'mobile';
  runNumber: number;
  score: number;
  lcp: Metric;
  fcp: Metric;
  cls: Metric;
  tbt: Metric;
  auditData: ComprehensivePsiData;
}

export interface MedianResult {
  url: string;
  strategy: string;
  runs: number;
  medianScore: number;
  medianLcp: number;
  medianFcp: number;
  medianCls: number;
  medianTbt: number;
  individualRuns: RunResult[];
  auditData: ComprehensivePsiData;
}

// Enhanced PageSpeed Insights audit data structures
export interface DOMElement {
  type: 'node';
  path: string;
  selector: string;
  snippet: string;
  nodeLabel: string;
  boundingRect?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  lhId?: string;
}

export interface PsiAuditItem {
  // Resource-related fields
  url?: string;
  wastedBytes?: number;
  wastedMs?: number;
  totalBytes?: number;

  // DOM-related fields
  node?: DOMElement;

  // Source code fields
  source?: {
    type: string;
    value: string;
  };

  // Specific audit fields
  resourceSize?: number;
  transferSize?: number;

  // Layout shift fields
  score?: number;

  // General fields
  label?: string;
  groupLabel?: string;
}

export interface PsiAuditDetails {
  type: 'table' | 'list' | 'opportunity' | 'debugdata' | 'treemap-data';
  headings?: Array<{
    key: string;
    label: string;
    valueType: 'text' | 'bytes' | 'ms' | 'url' | 'node';
  }>;
  items: PsiAuditItem[];
  overallSavingsMs?: number;
  overallSavingsBytes?: number;
  summary?: {
    wastedBytes?: number;
    wastedMs?: number;
  };
}

export interface PsiAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode:
    | 'numeric'
    | 'binary'
    | 'manual'
    | 'informative'
    | 'notApplicable'
    | 'error'
    | 'metricSavings';
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;

  // Performance impact
  metricSavings?: {
    LCP?: number;
    FCP?: number;
    TBT?: number;
    CLS?: number;
  };

  // Detailed audit information
  details?: PsiAuditDetails;

  // Error information
  errorMessage?: string;
  warnings?: string[];
}

export interface ComprehensivePsiData {
  url: string;
  strategy: 'desktop' | 'mobile';
  performanceScore: number;

  // Core metrics
  metrics: {
    lcp: number;
    fcp: number;
    cls: number;
    tbt: number;
    si: number; // Speed Index
    tti?: number; // Time to Interactive (deprecated but may exist)
  };

  // Categorized audits
  opportunities: PsiAudit[]; // Audits with potential savings
  diagnostics: PsiAudit[]; // Informational audits
  passedAudits: PsiAudit[]; // Successfully passed audits

  // Audit categories
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;

  // Additional metadata
  lighthouseVersion: string;
  fetchTime: string;
  environment?: {
    networkUserAgent: string;
    hostUserAgent: string;
    benchmarkIndex: number;
  };
}

// Enhanced PageSpeed Insights API response types
export interface LighthouseAudit {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  details?: unknown; // Will be parsed into PsiAuditDetails
  metricSavings?: Record<string, number>;
  errorMessage?: string;
  warnings?: string[];
}

export interface LighthouseAudits {
  [id: string]: LighthouseAudit;
}

export interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
  auditRefs: Array<{
    id: string;
    weight: number;
    group?: string;
  }>;
}

export interface LighthouseResult {
  requestedUrl: string;
  finalUrl: string;
  lighthouseVersion: string;
  userAgent: string;
  fetchTime: string;
  environment?: {
    networkUserAgent: string;
    hostUserAgent: string;
    benchmarkIndex: number;
  };
  runWarnings?: string[];

  categories: {
    performance: LighthouseCategory;
    accessibility?: LighthouseCategory;
    'best-practices'?: LighthouseCategory;
    seo?: LighthouseCategory;
  };

  audits: LighthouseAudits;
}

export interface PsiApiResponse {
  id: string;
  loadingExperience?: {
    id: string;
    metrics?: Record<string, unknown>;
    overall_category?: string;
    initial_url?: string;
  };
  originLoadingExperience?: {
    id: string;
    metrics?: Record<string, unknown>;
    overall_category?: string;
    initial_url?: string;
  };
  lighthouseResult: LighthouseResult;
  analysisUTCTimestamp?: string;
}
