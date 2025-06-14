# InsightsAI CLI

[![codecov](https://codecov.io/gh/jstnmthw/insights-ai/branch/main/graph/badge.svg?token=F7W8ZLUO1P)](https://codecov.io/gh/jstnmthw/insights-ai)

A robust Node.js CLI tool that batch‑runs Google PageSpeed Insights for any list of URLs defined in a YAML file, prints color‑coded metrics, and generates Markdown reports. Built for maintainability, testability, and CI/CD workflows.

---

## Table of Contents
- [Features](#features)
- [Quick start](#quick-start)
- [CLI Usage](#cli-usage)
  - [.env](#env)
  - [Config file format](#config-file-format)
- [Environment Variables](#environment-variables)
- [pnpm scripts](#pnpm-scripts)
- [Output](#output)
  - [Console Output](#console-output)
  - [Markdown Report](#markdown-report)
- [Multiple Runs & Reliability](#multiple-runs--reliability)
- [Customising](#customising)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Development & Quality](#development--quality)
  - [Lint, Format, Type-Check, Test](#lint-format-type-check-test)
  - [Pre-commit hooks](#pre-commit-hooks)
  - [Continuous Integration](#continuous-integration)
  - [Automated Releases](#automated-releases)
  - [Project Structure](#project-structure)
- [Testing](#testing)
- [Contributing](#contributing)

---

## Features

* Runs desktop and mobile tests for every URL
* **Multiple runs per URL** with median calculation for more reliable results
* **Visual progress bar** showing real-time test progress
* **Individual run logging** when multiple runs are configured
* Reads URL list from a user-defined YAML file (defaults to `urls.yml`)
* Concurrency‑limited API calls to avoid rate‑limit errors
* Extracts the key metrics: Performance Score, LCP, FCP, CLS, TBT
* **Color-coded metrics** based on Google's official thresholds
* **Emoji indicators** in Markdown reports for quick visual assessment
* Outputs clean ASCII tables with **muted gray headers**
* **Timestamped Markdown reports** saved to `logs/` directory
* Uses Google's public REST API – no local Chrome or Lighthouse required
* **AI-powered summaries** (optional) generated via OpenAI API with actionable performance recommendations
* Automatic "**Open in Cursor**" link for one-click remediation assistance

---

## Quick start

```bash
# 1  Clone and install dependencies
$ git clone <repo> InsightsAI && cd InsightsAI
$ pnpm install

# 2  Create and populate your .env file
$ touch .env                    # Open .env and add the following, replacing the placeholder key:

# 3  Define the URLs to audit
$ cp urls.example.yml urls.yml  # Edit urls.yml to list your pages

# 4  Build the TypeScript project
$ pnpm build

# 5  Run the CLI (built)
$ pnpm start                    # Uses urls.yml by default

# Or run directly in dev mode with ts-node:
$ pnpm dev                      # Uses ts-node & ESM loader

# You can also install globally after build:
$ pnpm link                     # Makes `InsightsAI` available system-wide
```

## CLI Usage

```
$ insights-ai [options]

Options:
  -c, --config <file>       Path to YAML config file (default: urls.yml)
  -k, --key <key>           PSI API Key (overrides env)
  -s, --strategies <list>   Comma-separated strategies (desktop,mobile)
  -p, --concurrency <n>     Concurrency level
  -r, --runs <n>            Runs per URL
```

### .env

Your `.env` file should contain the following variables. `PSI_KEY` is required.

```
PSI_KEY=YOUR_GOOGLE_PAGESPEED_API_KEY
PSI_CONFIG_FILE=urls.yml
PSI_STRATEGIES=desktop,mobile
PSI_CONCURRENCY=4
PSI_RUNS_PER_URL=1
AI_SUMMARY_ENABLED=true
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-3.5-turbo
```

### Config file format

`urls.yml`

```yaml
urls:
  - https://example.com
  - https://example.com/blog
```

---

## Environment Variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PSI_KEY` | *required* | Your Google PageSpeed Insights API key |
| `PSI_CONFIG_FILE` | `urls.yml` | Path to your YAML configuration file |
| `PSI_STRATEGIES` | `desktop,mobile` | Comma-separated list of test strategies |
| `PSI_CONCURRENCY` | `4` | Number of concurrent API requests |
| `PSI_RUNS_PER_URL` | `1` | Number of times to test each URL (for median calculation) |
| `AI_SUMMARY_ENABLED` | `false` | Set to `true` to append AI-generated summaries to the report |
| `OPENAI_API_KEY` | — | Your OpenAI API key (required when summaries are enabled) |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | Chat model to use for summaries |

---

## pnpm scripts

| Script                                    | Action                                  |
| ----------------------------------------- | --------------------------------------- |
| `pnpm pagespeed`                          | Run PageSpeed on the URLs in the YAML file defined in your .env |

---

## Output

The tool provides two types of output:

### Console Output
- **Progress bar** showing real-time test completion
- **Individual run results** (when `PSI_RUNS_PER_URL` > 1) showing each test result
- **Final results table** with median values and color-coded metrics
- All tables use **muted gray headers** and **traffic-light colors** for metrics

### Markdown Report
- Saved to `logs/psi-report-YYYY-MM-DDTHH-MM-SS.md`
- Contains the same data as console output in markdown format
- Includes individual runs (when applicable) and final median results
- **Color-coded emoji indicators** (🟢 Good, 🟡 Needs Improvement, 🔴 Poor) for quick visual assessment
- Perfect for sharing or archiving results

---

## Multiple Runs & Reliability

Setting `PSI_RUNS_PER_URL` to a value greater than 1 (recommended: 3-5) provides:

- **More reliable results** by reducing the impact of network variability
- **Median calculations** which are more robust than averages
- **Individual run visibility** so you can see the variation between tests
- **Better trend analysis** for performance monitoring over time

**Trade-offs:**
- Longer execution time (proportional to number of runs)
- Higher API quota usage
- More comprehensive and reliable data

---

## Customising

| Purpose                  | Location                                 |
| ------------------------ | ---------------------------------------- |
| Concurrency throttle     | Edit `PSI_CONCURRENCY` in `.env`     |
| Number of runs per URL   | Edit `PSI_RUNS_PER_URL` in `.env`     |
| Metrics collected        | Adjust the object returned by `runPSI()` in `pagespeed.mjs` |
| Output colour thresholds | Modify the color functions in `pagespeed.mjs`   |
| Strategies | Edit `PSI_STRATEGIES` in `.env` |

---

## Troubleshooting

| Problem                      | Solution                                             |
| ---------------------------- | ---------------------------------------------------- |
| `API key not valid`          | Confirm `PSI_KEY` in `.env`, regenerate if required. |
| Quota exceeded               | Lower concurrency or request higher quota.           |
| `Invalid or unsupported URL` | Ensure the URL begins with `https://`.               |
| Tests taking too long        | Reduce `PSI_RUNS_PER_URL` or `PSI_CONCURRENCY`.     |
| Progress bar not showing     | Ensure your terminal supports ANSI escape codes.     |

---

## License

MIT – see `LICENSE` for full text.

## Development & Quality

### Lint, Format, Type-Check, Test

```sh
$ pnpm lint         # ESLint
$ pnpm format       # Prettier
$ pnpm type-check   # TypeScript strict type checking
$ pnpm test         # Run the Vitest suite once
$ pnpm test:watch   # Watch mode for rapid feedback
$ pnpm test:coverage # Generate Istanbul coverage report (≥ 98 % required)
```

### Pre-commit hooks
Husky + lint-staged auto-fix and format code before every commit.

### Continuous Integration
CI runs lint, type-check and the complete Vitest suite (with coverage threshold defined in Vitest config) on every push/PR.

### Automated Releases
This project uses **[semantic-release](https://semantic-release.gitbook.io/semantic-release/)** to automate versioning, changelog generation, and release publishing. All releases are triggered automatically from the `main` branch based on conventional commit messages.

For a detailed guide on the release workflow, see [**Automated Releases**](./docs/AUTOMATED_RELEASES.md).

### Project Structure

- `src/` – source code (modular: config, services, utils, types, errors)
- `tests/` – unit and integration tests
- `logs/` – generated reports
- `docs/` – documentation

## Testing

The project uses **[Vitest](https://vitest.dev)** for both unit and integration tests. Coverage is collected with Istanbul and enforced in CI.

```sh
$ pnpm test            # one-off run
$ pnpm test:watch      # interactive watch mode
$ pnpm test:coverage   # generates HTML & lcov reports in /coverage
```

Current suite exceeds **98 %** line and statement coverage while exercising all critical paths (config errors, disk-write failures, API failure handling, etc.).

## Contributing

Please use feature branches and submit pull requests. All code must pass lint, type, and test checks before merge.
