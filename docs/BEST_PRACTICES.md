# InsightsAI - Best Practices Guide

This document outlines the best practices and standards for the InsightsAI project. Following these guidelines will help maintain code quality, improve maintainability, and ensure consistent development practices across the team.

## Table of Contents
1. [Project Structure](#project-structure)
2. [Code Organization](#code-organization)
3. [Error Handling](#error-handling)
4. [Testing Strategy](#testing-strategy)
5. [Performance Optimization](#performance-optimization)
6. [Documentation Standards](#documentation-standards)
7. [Security Considerations](#security-considerations)
8. [Development Workflow](#development-workflow)
9. [Code Style Guide](#code-style-guide)
10. [Future Improvements](#future-improvements)
11. [TypeScript Standards](#type-script-standards)

## Project Structure

### Current Structure
```
InsightsAI/
├── docs/                  # Documentation
├── logs/                 # Generated reports
├── src/                  # Source code (to be implemented)
├── tests/                # Test files (to be implemented)
├── .env.example         # Environment variables template
├── .gitignore           # Git ignore rules
├── package.json         # Project configuration
├── pagespeed.mjs        # Main application file
└── urls.yml             # URL configuration
```

### Recommended Structure
```
InsightsAI/
├── docs/                  # Documentation
│   ├── BEST_PRACTICES.md  # This file
│   └── API.md            # API documentation
├── src/                   # Source code
│   ├── config/           # Configuration
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript definitions
├── tests/                # Test files
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test fixtures
├── logs/                # Generated reports
├── scripts/             # Build and utility scripts
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore rules
├── package.json        # Project configuration
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project documentation
```

## Code Organization

### 1. Modular Architecture
- Split the monolithic `pagespeed.mjs` into smaller, focused modules:
  ```javascript
  // src/services/psi.service.js
  export class PSIService {
    async runTest(url, strategy) { ... }
  }

  // src/services/report.service.js
  export class ReportService {
    generateConsoleReport(results) { ... }
    generateMarkdownReport(results) { ... }
  }

  // src/utils/metrics.js
  export const getScoreEmoji = (score) => { ... }
  export const getLcpEmoji = (lcp) => { ... }
  ```

### 2. Configuration Management
- Move all configuration to dedicated files:
  ```javascript
  // src/config/metrics.config.js
  export const METRICS_THRESHOLDS = {
    score: { good: 90, needsImprovement: 50 },
    lcp: { good: 2500, needsImprovement: 4000 },
    // ...
  };
  ```

### 3. Type Safety
- Implement TypeScript for better type safety and developer experience:
  ```typescript
  // src/types/metrics.ts
  interface MetricResult {
    score: number;
    lcp: { display: string; numeric: number };
    // ...
  }
  ```

## Error Handling

### 1. Custom Error Classes
```typescript
// src/errors/api.error.ts
export class APIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'APIError';
  }
}
```

### 2. Error Boundaries
```javascript
// src/utils/error-handler.js
export const handleError = (error) => {
  if (error instanceof APIError) {
    // Handle API errors
  } else if (error instanceof ValidationError) {
    // Handle validation errors
  } else {
    // Handle unexpected errors
  }
};
```

### 3. Graceful Degradation
- Implement fallback mechanisms for API failures
- Cache results when possible
- Provide meaningful error messages to users

## Testing Strategy

### 1. Unit Tests
```javascript
// tests/unit/metrics.test.js
describe('Metrics Utils', () => {
  test('getScoreEmoji returns correct emoji', () => {
    expect(getScoreEmoji(95)).toBe('🟢');
    expect(getScoreEmoji(75)).toBe('🟡');
    expect(getScoreEmoji(45)).toBe('🔴');
  });
});
```

### 2. Integration Tests
```javascript
// tests/integration/psi.test.js
describe('PSI Service', () => {
  test('successfully runs test and generates report', async () => {
    const results = await psiService.runTest('https://example.com', 'desktop');
    expect(results).toHaveProperty('score');
    expect(results).toHaveProperty('lcp');
  });
});
```

### 3. Test Coverage
- Aim for **≥98 %** line & statement coverage (enforced in CI)
- Use **Vitest** with Istanbul provider for coverage
- Run the suite in both fast-fail (`pnpm test`) and coverage modes (`pnpm test:coverage`) in CI

## Performance Optimization

### 1. Caching
```javascript
// src/services/cache.service.js
export class CacheService {
  async getCachedResult(url, strategy) {
    const key = `${url}-${strategy}`;
    return await this.cache.get(key);
  }
}
```

### 2. Rate Limiting
```javascript
// src/utils/rate-limiter.js
export const rateLimiter = pLimit(CONCURRENCY);
```

### 3. Memory Management
- Implement proper cleanup of resources
- Monitor memory usage
- Use streams for large files

## Documentation Standards

### 1. Code Documentation
```javascript
/**
 * Runs a PageSpeed Insights test for a given URL and strategy
 * @param {string} url - The URL to test
 * @param {string} strategy - The test strategy (desktop/mobile)
 * @returns {Promise<MetricResult>} The test results
 * @throws {APIError} If the API request fails
 */
async function runPSI(url, strategy) {
  // Implementation
}
```

### 2. API Documentation
- Use OpenAPI/Swagger for API documentation
- Document all endpoints, parameters, and responses
- Include example requests and responses

### 3. README Standards
- Clear installation instructions
- Usage examples
- Configuration options
- Troubleshooting guide

## Security Considerations

### 1. API Key Management
- Never commit API keys to version control
- Use environment variables
- Implement key rotation

### 2. Input Validation
```javascript
// src/utils/validator.js
export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
```

### 3. Error Message Sanitization
- Never expose internal errors to users
- Log detailed errors for debugging
- Provide user-friendly error messages

## Development Workflow

### 1. Git Workflow
- Use feature branches
- Implement pull request reviews
- Follow conventional commits

### 2. Code Review Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Performance considered
- [ ] Security reviewed

### 3. CI/CD Pipeline
- Automated testing
- Linting
- Type checking
- Build verification

## Code Style Guide

### 1. Naming Conventions
```javascript
// Constants
const MAX_RETRIES = 3;

// Classes
class PSIService {}

// Functions
function calculateMedian() {}

// Variables
let currentProgress;
```

### 2. Code Formatting
- Use Prettier for consistent formatting
- ESLint for code quality
- EditorConfig for editor settings

### 3. Best Practices
- Use async/await over callbacks
- Implement proper error handling
- Write self-documenting code
- Keep functions small and focused

## Future Improvements

### 1. Technical Debt
- [ ] Migrate to TypeScript
- [ ] Implement proper logging
- [ ] Add monitoring
- [ ] Improve error handling

### 2. Feature Roadmap
- [ ] Support for custom metrics
- [ ] Historical data tracking
- [ ] Performance trend analysis
- [ ] Automated recommendations

### 3. Infrastructure
- [ ] Docker support
- [ ] Kubernetes deployment
- [ ] Monitoring and alerting
- [ ] Automated backups

## Implementation Priority

1. **High Priority**
   - TypeScript migration
   - Test coverage
   - Error handling
   - Documentation

2. **Medium Priority**
   - Caching implementation
   - Performance optimization
   - CI/CD pipeline
   - Monitoring

3. **Low Priority**
   - Additional features
   - Infrastructure improvements
   - UI enhancements

## TypeScript Standards

The codebase is compiled with **`"strict": true`** and follows these additional rules:

1. **Never use `any`.**
   • If third-party libraries lack type definitions, first look for `@types/` packages on npm.<br/>
   • If none exist, create a minimal declaration in `src/types/` instead of casting to `any`.
2. **Prefer `unknown` over `any`** when a truly dynamic value is required; perform type-guards before use.
3. **No implicit `any` or `this` errors** – always annotate function parameters and return types when inference is not obvious.
4. **Enable and respect** the following compiler flags (already set in `tsconfig.json`):
   * `strictNullChecks`, `noImplicitAny`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`.
5. **Leverage utility types** (`Partial`, `Required`, `Readonly`, `Record`, etc.) rather than manual mappings.
6. **Prefer composition over inheritance** – use interfaces & type aliases to compose behaviour.
7. **Keep domain models in `src/types/`** and import from there, never duplicate ad-hoc interfaces across modules.
8. **Avoid namespace pollution** – use `import type { … }` for type-only imports.
9. **Generic functions & classes** must be constrained (`<T extends ...>`) to avoid overly-broad generics.
10. **ESM only** – no `require` or CommonJS interop except in `node:` built-ins where unavoidable.

## Conclusion

Following these best practices will help maintain code quality and make the project more maintainable. Regular reviews and updates to this document will ensure it remains relevant and useful for the team.

Remember:
- Write code for humans, not machines
- Document as you go
- Test thoroughly
- Review regularly
- Keep learning and improving 