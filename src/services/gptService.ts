import { URL } from 'node:url';

import { ApiError } from '../errors/index.js';
import type { ComprehensivePsiData } from '../types/psi.js';

/**
 * Subset of the Lighthouse data that we care about for the AI prompt.
 * Consumers may supply any JSON-serialisable data – this service will simply
 * embed it into the prompt verbatim.
 */
export type CondensedPsiData = Record<string, unknown>;

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
   * Generates a Markdown summary from condensed Lighthouse data (legacy method).
   *
   * @deprecated Use generateComprehensiveReportSummary for detailed analysis
   * @param psiData A reduced Lighthouse JSON object containing only basic metrics
   * @returns Markdown string ready to be embedded into the report.
   */
  async generateReportSummary(psiData: CondensedPsiData): Promise<string> {
    const prompt = this.buildBasicPrompt(psiData);
    return this.callOpenAI(prompt);
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

    // Create summary of key opportunities with specific details
    const opportunitiesSummary = opportunities
      .slice(0, 10) // Top 10 opportunities
      .map((opp) => {
        const savings = opp.metricSavings
          ? Object.entries(opp.metricSavings)
              .map(([metric, value]) => `${metric}: ${value}ms`)
              .join(', ')
          : 'See details';

        const itemsInfo =
          opp.details?.items
            ?.slice(0, 3)
            .map((item) => {
              if (item.url) return `File: ${item.url}`;
              if (item.node?.selector) return `Element: ${item.node.selector}`;
              return 'Resource identified';
            })
            .join('; ') || 'Multiple resources';

        return `- ${opp.title}: ${opp.displayValue || savings} (${itemsInfo})`;
      })
      .join('\n');

    // Create summary of key diagnostics
    const diagnosticsSummary = diagnostics
      .slice(0, 5) // Top 5 diagnostics
      .map((diag) => {
        const itemsInfo =
          diag.details?.items
            ?.slice(0, 2)
            .map((item) => {
              if (item.node?.selector) return item.node.selector;
              if (item.url) {
                try {
                  return new URL(item.url).pathname;
                } catch {
                  return item.url;
                }
              }
              return 'See details';
            })
            .join(', ') || '';

        return `- ${diag.title}${itemsInfo ? ` (${itemsInfo})` : ''}`;
      })
      .join('\n');

    return `
You are a senior web performance engineer analyzing a comprehensive PageSpeed Insights report. 
Provide specific, actionable recommendations based on the actual audit findings.

## Website Analysis Request
URL: ${url} (${strategy})
Performance Score: ${performanceScore}/100

## Core Web Vitals
- LCP (Largest Contentful Paint): ${metrics.lcp}ms
- FCP (First Contentful Paint): ${metrics.fcp}ms  
- CLS (Cumulative Layout Shift): ${metrics.cls}
- TBT (Total Blocking Time): ${metrics.tbt}ms
- Speed Index: ${metrics.si}ms

## Key Performance Opportunities (${opportunities.length} total)
${opportunitiesSummary || 'No major opportunities identified'}

## Key Diagnostics (${diagnostics.length} total)  
${diagnosticsSummary || 'No significant diagnostics'}

## Full Audit Data
${JSON.stringify({ opportunities: opportunities.slice(0, 5), diagnostics: diagnostics.slice(0, 3) }, null, 2)}

## Instructions
Analyze this data and provide a response in the following Markdown format:

### Performance Analysis for ${url} (${strategy})

#### Overview
Write a 2-3 sentence technical overview of the page's performance, highlighting the most critical issues found in the audit data.

#### Key Issues  
List the top 3-5 most critical performance bottlenecks with:
- Specific metric values from the audit
- Exact file names, URLs, or DOM selectors when available
- Estimated performance impact

#### Recommendations
Provide 3-5 specific, actionable recommendations that reference:
- Exact files, resources, or DOM elements identified in the opportunities
- Specific optimization techniques (e.g., "lazy load images in /images/ directory")
- Expected performance improvements (e.g., "reduce LCP by ~200ms")

Focus on the actual audit findings rather than generic advice. Reference specific files, selectors, and measurements from the data provided.
`;
  }

  /**
   * Builds the legacy basic prompt (for backward compatibility).
   */
  private buildBasicPrompt(data: CondensedPsiData): string {
    return `
    Analyze the following Lighthouse JSON data and provide a summary for a senior web developer.
Response should be in markdown format
The header should be named: "Performance Analysis for <url> (<strategy>)"
Example header levels:
\`\`\`md
### Performance Analysis for https://tp.fazwaz.com (desktop)
#### Overview
#### Key Issues
#### Recommendations
\`\`\`
Format the output in Markdown with four sections:
1. **Overview**: A one-paragraph summary of the page's performance.
3. **Key Issues**: A bulleted list of the top 3-5 most critical performance bottlenecks (e.g., LCP, TBT, CLS) with their values.
3. **Recommendations**: A bulleted list of actionable, developer-focused suggestions for fixing the identified issues.

Lighthouse Data:
${JSON.stringify(data)}`;
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
