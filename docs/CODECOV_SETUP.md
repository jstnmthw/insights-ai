# Codecov Integration Setup

This document outlines the Codecov integration for the InsightsAI project, providing automated code coverage reporting and tracking.

## Overview

Codecov is integrated into our CI/CD pipeline to:
- Track code coverage across PRs and main branch
- Provide coverage diffs for pull requests
- Maintain coverage quality gates
- Generate coverage reports and badges

## Integration Points

### 1. Pull Request Workflow (`.github/workflows/ci.yml`)
- **Trigger**: On PRs to `main` branch
- **Purpose**: Provides coverage diff and prevents regression
- **Features**:
  - Runs full test suite with coverage
  - Uploads coverage to Codecov with `unittests` flag
  - Shows coverage impact in PR comments
  - Includes linting and type checking

### 2. Main Branch Workflow (`.github/workflows/release.yml`)
- **Trigger**: On pushes to `main` branch
- **Purpose**: Updates baseline coverage metrics
- **Features**:
  - Runs tests with coverage before release
  - Uploads coverage with `unittests,main` flags
  - Integrates with semantic-release workflow

## Configuration

### Required Secrets
Add the following secret to your GitHub repository:
- `CODECOV_TOKEN`: Your Codecov upload token (get from codecov.io)

### Coverage Settings
Current coverage thresholds (defined in `vitest.config.ts`):
- **Statements**: 96%
- **Lines**: 98%
- **Functions**: 100%
- **Branches**: 85%

### Coverage Exclusions
The following are excluded from coverage:
- `dist/` - Built artifacts
- `coverage/` - Coverage reports
- `node_modules/` - Dependencies
- `src/cli.ts` - CLI entry point

## Setup Instructions

### 1. Codecov Account Setup
1. Visit [codecov.io](https://codecov.io) and sign up with your GitHub account
2. Add your repository to Codecov
3. Copy the upload token from your repository settings

### 2. GitHub Repository Setup
1. Go to your repository settings → Secrets and variables → Actions
2. Add new repository secret:
   - Name: `CODECOV_TOKEN`
   - Value: Your Codecov upload token

### 3. Branch Protection (Recommended)
Consider adding branch protection rules for `main`:
- Require status checks to pass before merging
- Require "Test & Coverage" check to pass
- Require up-to-date branches before merging

## Usage

### For Developers
- **PRs**: Coverage runs automatically on PR creation/updates
- **Local**: Run `pnpm test:coverage` to generate local coverage reports
- **Viewing**: Coverage reports are available in the `coverage/` directory

### Coverage Reports
- **HTML Report**: `coverage/index.html` (local)
- **LCOV Report**: `coverage/lcov.info` (uploaded to Codecov)
- **Text Report**: Displayed in terminal during test runs

### Codecov Features
- **Coverage Diff**: Shows coverage changes in PRs
- **Coverage Trends**: Track coverage over time
- **Sunburst Chart**: Visual representation of coverage
- **File Browser**: Line-by-line coverage view

## Quality Gates

### Current Standards
- **Minimum Coverage**: 96% statements, 98% lines
- **Function Coverage**: 100% (all functions must be tested)
- **Branch Coverage**: 85% minimum

### Failure Behavior
- **Local Tests**: Fail if coverage thresholds not met
- **CI Pipeline**: Coverage upload continues even if Codecov fails
- **PR Comments**: Codecov bot comments on coverage changes

## Troubleshooting

### Coverage Discrepancy Between Local and Codecov

**Problem**: Local coverage shows 97.87% but Codecov shows ~90%

**Root Cause**: Different coverage calculation methods
- **Local Vitest**: Reports **statement coverage** (97.87%)
- **Codecov**: Uses a **weighted average** of lines + branches coverage
  - Lines: 98.45%
  - Branches: 87.68%
  - Weighted average: ~90%

**Solutions**:
1. **Create codecov.yml** to align with local settings (already provided)
2. **Focus on branch coverage** - the 87.68% branch coverage is pulling down the overall score
3. **Improve branch coverage** by testing more conditional paths and error scenarios

**To debug coverage discrepancies**:
```bash
# Run local coverage with detailed output
pnpm test:coverage:debug

# Check lcov file metrics
awk '/^LF:/ {total_lines+=$2} /^LH:/ {covered_lines+=$2} /^BRF:/ {total_branches+=$2} /^BRH:/ {covered_branches+=$2} END {if(total_lines>0) printf "Lines: %.2f%% (%d/%d)\n", covered_lines/total_lines*100, covered_lines, total_lines; if(total_branches>0) printf "Branches: %.2f%% (%d/%d)\n", covered_branches/total_branches*100, covered_branches, total_branches}' FS=: coverage/lcov.info
```

### Common Issues

#### 1. Missing Coverage Report
```bash
# Ensure LCOV reporter is enabled in vitest.config.ts
coverage: {
  reporter: ['text', 'html', 'lcov']
}
```

#### 2. Upload Failures
- Check `CODECOV_TOKEN` secret is set correctly
- Verify repository is added to Codecov account
- Check network connectivity in CI environment

#### 3. Coverage Threshold Failures
- Run `pnpm test:coverage` locally to identify uncovered code
- Add tests for uncovered functions/branches
- Consider adjusting thresholds if appropriate

### Debugging
Enable verbose logging by setting `verbose: true` in codecov action:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    verbose: true
```

## Badge Integration

Add coverage badge to README.md:
```markdown
[![codecov](https://codecov.io/gh/YOUR_USERNAME/insights-ai/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/insights-ai)
```

## Maintenance

### Regular Tasks
- Monitor coverage trends monthly
- Review and adjust thresholds as codebase matures
- Update exclusion patterns for new directories
- Ensure new features include appropriate tests

### Upgrading
- Keep `codecov/codecov-action` updated to latest version
- Monitor Codecov changelog for breaking changes
- Test coverage uploads after major updates

## Resources

- [Codecov Documentation](https://docs.codecov.com/)
- [GitHub Actions Integration](https://docs.codecov.com/docs/github-actions)
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage.html)
- [Istanbul Coverage Provider](https://istanbul.js.org/) 