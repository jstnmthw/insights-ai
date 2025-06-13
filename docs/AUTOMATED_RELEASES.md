# Understanding the Release Workflow in InsightsAI

## Table of Contents
- [Overview](#overview)
- [How It Works](#how-it-works)
  - [Commit Message Convention](#1-commit-message-convention)
  - [Release Process Flow](#2-release-process-flow)
  - [Example Workflow](#3-example-workflow)
- [Best Practices](#4-best-practices)
  - [Commit Messages](#commit-messages)
  - [Branch Management](#branch-management)
  - [Release Review](#release-review)
- [Common Scenarios](#5-common-scenarios)
  - [Hotfix Release](#1-hotfix-release)
  - [Feature Release](#2-feature-release)
  - [Breaking Change](#3-breaking-change)
- [Troubleshooting](#6-troubleshooting)
- [GitHub Token Configuration](#7-github-token-configuration)
  - [Create a Personal Access Token (PAT)](#1-create-a-personal-access-token-pat)
  - [Configure Repository Secret](#2-configure-repository-secret)
  - [Update GitHub Actions Workflow](#3-update-github-actions-workflow)
  - [Common Issues](#4-common-issues)
- [References](#references)

## Overview

This document explains how our automated release process works in InsightsAI using `semantic-release` and GitHub Actions. The system automatically handles versioning, changelog generation, and release publishing based on your commit messages.

## How It Works

### 1. Commit Message Convention

Our release process is driven by your commit messages. Each commit should follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Common types:
- `feat`: A new feature (triggers a minor version bump)
- `fix`: A bug fix (triggers a patch version bump)
- `BREAKING CHANGE`: Any commit with this in the footer (triggers a major version bump)
- `chore`: Maintenance tasks (no version bump)
- `docs`: Documentation changes (no version bump)
- `style`: Code style changes (no version bump)
- `refactor`: Code refactoring (no version bump)
- `test`: Adding or modifying tests (no version bump)

Examples:
```
feat(report): add markdown export option
fix(metrics): correct FCP calculation
chore(deps): update dependency p-limit to v4
```

### 2. Release Process Flow

1. **Push to Main Branch**
   - When you push commits to the main branch, GitHub Actions automatically triggers
   - The workflow runs tests to ensure everything is working

2. **Version Determination**
   - `semantic-release` analyzes all commits since the last release
   - It determines the next version number based on commit types:
     - Major: Breaking changes
     - Minor: New features
     - Patch: Bug fixes

3. **Release Creation**
   - Generates/updates CHANGELOG.md with all changes
   - Creates a new Git tag
   - Creates a GitHub Release with release notes
   - Updates version in package.json

### 3. Example Workflow

Let's walk through a typical release scenario:

1. **Initial State**
   - Current version: 1.0.0
   - No unreleased changes

2. **Developer Makes Changes**
   ```bash
   git commit -m "feat(report): add PDF export"
   git commit -m "fix(metrics): correct calculation error"
   git commit -m "docs: update API documentation"
   git push origin main
   ```

3. **Release Process**
   - GitHub Actions runs tests
   - `semantic-release` analyzes commits:
     - One feature → minor version bump
     - One fix → patch version bump
     - One docs change → no version impact
   - New version determined: 1.1.0
   - Release created with changelog entries

### 4. Best Practices

- **Commit Messages**
  - Be specific in your commit messages
  - Use appropriate scopes
  - Include breaking changes in the footer when necessary

- **Branch Management**
  - Always work in feature branches
  - Use pull requests for code review
  - Merge to main only when ready for release

- **Release Review**
  - Review the generated changelog
  - Verify the version bump is correct
  - Check that all changes are properly documented

### 5. Common Scenarios

1. **Hotfix Release**
   ```
   fix(security): patch critical vulnerability
   ```
   - Creates a patch version (e.g., 1.1.0 → 1.1.1)

2. **Feature Release**
   ```
   feat(api): add new endpoint
   ```
   - Creates a minor version (e.g., 1.1.1 → 1.2.0)

3. **Breaking Change**
   ```
   feat(api): restructure response format

   BREAKING CHANGE: API response format has changed
   ```
   - Creates a major version (e.g., 1.2.0 → 2.0.0)

### 6. Troubleshooting

If a release doesn't happen as expected:

1. **Check Commit Messages**
   - Ensure they follow conventional format
   - Verify the type is correct

2. **Check GitHub Actions**
   - Look for workflow failures
   - Verify all tests are passing

3. **Check Permissions**
   - Ensure GitHub token has proper permissions
   - Verify branch protection rules
   - If using GitHub Actions, you need a Personal Access Token (PAT) with:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)
   - Add the PAT as a repository secret (e.g., `GH_TOKEN`)
   - Update the workflow to use `GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}`
   - Add `fetch-depth: 0` to the checkout action to ensure full git history access

### 7. GitHub Token Configuration

For semantic-release to work properly in GitHub Actions, you need to configure the correct permissions:

1. **Create a Personal Access Token (PAT)**
   - Go to GitHub Settings → Developer Settings → Personal Access Tokens
   - Create a new token with these permissions:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)
   - Set an appropriate expiration date
   - Copy the generated token

2. **Configure Repository Secret**
   - Go to your repository's Settings → Secrets and variables → Actions
   - Create a new repository secret named `GH_TOKEN`
   - Paste your PAT as the value

3. **Update GitHub Actions Workflow**
   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0  # Required for semantic-release
   - name: Semantic Release
     env:
       GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}  # Use PAT instead of default GITHUB_TOKEN
     run: npx semantic-release
   ```

4. **Common Issues**
   - If you see "Permission denied" errors, verify your PAT has the correct permissions
   - If semantic-release can't access git history, ensure `fetch-depth: 0` is set
   - If releases aren't being created, check that the PAT has `repo` access

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/semantic-release/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions) 