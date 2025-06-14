import { URL } from 'node:url';

import { ApiError } from '../errors/index.js';
import type { ComprehensivePsiData } from '../types/psi.js';

export interface GptServiceOptions {
  apiKey: string;
  /** Optional – override the default "gpt-3.5-turbo" model. */
  model?: string;
}

export class GptService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: GptServiceOptions) {
    if (!opts.apiKey) {
      throw new ApiError('Missing OpenAI API key');
    }

    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'gpt-3.5-turbo';
  }

  /**
   * Generates a comprehensive Markdown summary from full PageSpeed Insights audit data.
   *
   * This method analyzes the complete audit data including opportunities, diagnostics,
   * specific files, DOM elements, and performance issues to provide actionable,
   * specific recommendations based on actual PageSpeed Insights findings.
   *
   * @param auditData Complete PageSpeed Insights audit data with opportunities and diagnostics
   * @returns Detailed Markdown string with specific recommendations
   */
  async generateComprehensiveReportSummary(auditData: ComprehensivePsiData): Promise<string> {
    const prompt = this.buildComprehensivePrompt(auditData);
    return this.callOpenAI(prompt);
  }

  /**
   * Makes the actual OpenAI API call.
   */
  private async callOpenAI(prompt: string): Promise<string> {
    let resp: Response;
    try {
      resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
        }),
      });
    } catch (err) {
      throw new ApiError('Network error while contacting OpenAI', err);
    }

    if (!resp.ok) {
      const errorBody = await this.safeReadText(resp);
      throw new ApiError(`OpenAI API error (${resp.status})`, errorBody);
    }

    const data: unknown = await resp.json();
    const summary = this.extractSummary(data);
    if (!summary) {
      throw new ApiError('Unexpected OpenAI API response shape');
    }

    return summary.trim();
  }

  /**
   * Builds a comprehensive prompt with full audit data.
   */
  private buildComprehensivePrompt(auditData: ComprehensivePsiData): string {
    const { url, strategy, performanceScore, metrics, opportunities, diagnostics } = auditData;

    // Calculate performance severity
    const severity =
      performanceScore >= 90
        ? 'excellent'
        : performanceScore >= 70
          ? 'good'
          : performanceScore >= 50
            ? 'needs improvement'
            : 'poor';

    // Prioritize opportunities by impact
    const criticalOpportunities = opportunities
      .filter(
        (opp) =>
          opp.metricSavings && Object.values(opp.metricSavings).some((saving) => saving >= 100)
      )
      .slice(0, 8);

    const regularOpportunities = opportunities
      .filter((opp) => !criticalOpportunities.includes(opp))
      .slice(0, 5);

    // Create detailed opportunities summary
    const opportunitiesSummary = [...criticalOpportunities, ...regularOpportunities]
      .map((opp) => {
        const savings = opp.metricSavings
          ? Object.entries(opp.metricSavings)
              .map(([metric, value]) => `${metric}: ${value}ms`)
              .join(', ')
          : 'Performance impact available';

        const resources =
          opp.details?.items
            ?.slice(0, 4)
            .map((item) => {
              if (item.url) {
                try {
                  const urlObj = new URL(item.url);
                  const filename = urlObj.pathname.split('/').pop() || urlObj.pathname;
                  const sizeInfo = item.wastedBytes
                    ? ` (${Math.round(item.wastedBytes / 1024)}KB wasted)`
                    : '';
                  return `${filename}${sizeInfo}`;
                } catch {
                  return item.url;
                }
              }
              if (item.node?.selector) return `DOM: ${item.node.selector}`;
              return 'Resource';
            })
            .join(', ') || 'Multiple resources';

        const priority = criticalOpportunities.includes(opp) ? '[HIGH IMPACT]' : '[MEDIUM]';
        return `${priority} ${opp.title}: ${opp.displayValue || savings} (${resources})`;
      })
      .join('\n');

    // Create diagnostics summary
    const diagnosticsSummary = diagnostics
      .slice(0, 6)
      .map((diag) => {
        const specifics =
          diag.details?.items
            ?.slice(0, 3)
            .map((item) => {
              if (item.node?.selector) return item.node.selector;
              if (item.url) {
                try {
                  const urlObj = new URL(item.url);
                  return urlObj.pathname.split('/').pop() || urlObj.pathname;
                } catch {
                  return item.url;
                }
              }
              return 'See details';
            })
            .join(', ') || '';

        return `- ${diag.title}${specifics ? ` (${specifics})` : ''}: ${diag.displayValue || 'Check implementation'}`;
      })
      .join('\n');

    return `You are a senior web performance consultant conducting a comprehensive PageSpeed Insights audit. Your analysis will be read by developers who need specific, actionable guidance to improve their site's performance.

CONTEXT:
- Website: ${url} (${strategy} analysis)
- Current Performance Score: ${performanceScore}/100 (${severity} performance)
- Primary Metrics: LCP ${metrics.lcp}ms | FCP ${metrics.fcp}ms | CLS ${metrics.cls} | TBT ${metrics.tbt}ms | SI ${metrics.si}ms

CRITICAL PERFORMANCE OPPORTUNITIES (${opportunities.length} total identified):
${opportunitiesSummary || 'No major optimization opportunities identified'}

DIAGNOSTIC INSIGHTS (${diagnostics.length} total):
${diagnosticsSummary || 'No significant diagnostic issues found'}

DETAILED AUDIT DATA:
${JSON.stringify(
  {
    topOpportunities: opportunities.slice(0, 3),
    keyDiagnostics: diagnostics.slice(0, 2),
    metrics: metrics,
  },
  null,
  2
)}

ANALYSIS REQUIREMENTS:
Please provide a comprehensive performance analysis following this exact structure:

### Performance Analysis for ${url} (${strategy})

#### 🎯 Executive Summary
Provide a concise 2-3 sentence assessment of the site's performance, highlighting the performance score context and the most impactful optimization potential.

#### ⚠️ Critical Issues
List the top 3-4 performance bottlenecks that have the highest impact on user experience:
- **Issue Name**: Specific metric impact (e.g., "increases LCP by 800ms")
- **Root Cause**: Exact files, resources, or implementation patterns causing the issue
- **Business Impact**: How this affects users (loading time, visual stability, etc.)

#### 🚀 Priority Recommendations
Provide 4-6 specific, actionable recommendations ordered by implementation impact:

1. **[HIGH IMPACT]** Recommendation title
   - **What to do**: Specific technical steps
   - **Files/Resources**: Exact files or elements to modify
   - **Expected Improvement**: Quantified performance gains
   - **Implementation Complexity**: Low/Medium/High

2. **[MEDIUM IMPACT]** ...continue pattern

#### 📊 Performance Metrics Analysis
Brief analysis of Core Web Vitals performance:
- **LCP (${metrics.lcp}ms)**: Assessment and target
- **FCP (${metrics.fcp}ms)**: Assessment and target  
- **CLS (${metrics.cls})**: Assessment and target
- **TBT (${metrics.tbt}ms)**: Assessment and target

#### 🔧 Implementation Priority
Suggest an implementation roadmap:
1. **Quick Wins** (1-2 days): List 2-3 easy implementations
2. **Medium Effort** (1-2 weeks): List 2-3 moderate implementations  
3. **Long-term** (1+ months): List 1-2 complex implementations

IMPORTANT GUIDELINES:
- Reference ONLY the specific files, URLs, and DOM selectors found in the audit data
- Quantify performance improvements using the metricSavings data provided
- Focus on implementable solutions rather than generic advice
- Prioritize recommendations that address Core Web Vitals directly
- Use the exact resource names and paths from the audit data
- Be specific about file sizes, byte savings, and timing improvements
- Consider the interconnections between different optimizations`;
  }

  /**
   * Extracts the assistant message from the OpenAI response.
   */
  private extractSummary(resp: unknown) {
    if (typeof resp !== 'object' || resp === null || !('choices' in resp)) {
      return undefined;
    }

    const choices = (resp as { choices: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return undefined;

    const first = choices[0] as { message?: { content?: unknown } };
    const content = first.message?.content;

    return typeof content === 'string' ? content : undefined;
  }

  private async safeReadText(resp: Response): Promise<string | undefined> {
    try {
      return await resp.text();
    } catch {
      return undefined;
    }
  }
}
