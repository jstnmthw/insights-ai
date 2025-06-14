import { ApiError } from '../errors/index.js';

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
   * Generates a Markdown summary from condensed Lighthouse data.
   *
   * The summary follows this structure:
   * 1. **Overview** – single-paragraph high-level assessment.
   * 2. **Key Issues** – bullet list of the most critical problems (values included).
   * 3. **Recommendations** – bullet list of actionable improvements.
   *
   * @param psiData A reduced Lighthouse JSON object containing only the
   *                information required for the model to make recommendations.
   * @returns Markdown string ready to be embedded into the report.
   */
  async generateReportSummary(psiData: CondensedPsiData): Promise<string> {
    const prompt = this.buildPrompt(psiData);

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

  private buildPrompt(data: CondensedPsiData): string {
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
