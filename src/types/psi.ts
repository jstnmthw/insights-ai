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
}

// PageSpeed Insights API response types
export interface LighthouseAudit {
  displayValue?: string;
  numericValue?: number;
}

export interface LighthouseAudits {
  [id: string]: LighthouseAudit;
}

export interface LighthouseResult {
  categories: {
    performance: {
      score: number;
    };
  };
  audits: LighthouseAudits;
}

export interface PsiApiResponse {
  lighthouseResult: LighthouseResult;
}
