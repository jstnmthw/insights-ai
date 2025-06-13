# InsightsAI Test Suite

This `tests/` directory is organised to reflect the two-tier testing strategy defined in `BEST_PRACTICES.md`.

## Directory layout

```
tests/
├── fixtures/        # Static data files (YAML, JSON, Markdown, …)
├── integration/     # Cross-module / workflow tests
├── unit/            # Fast, isolated tests for individual modules
└── README.md        # This file
```

## Running tests

```bash
pnpm test           # executes all tests once
pnpm test:watch     # interactive watch mode for development
pnpm test:coverage  # generates coverage report (HTML + lcov)
```

> Coverage thresholds are enforced in CI to remain above **80 %**.

## Writing new tests

1. **Choose the right level**: prefer unit tests for pure functions; use integration tests when several modules collaborate.
2. **Follow naming conventions**: `*.test.ts` under `unit/` or `integration/`.
3. **Isolate external dependencies** using `vi.mock()`.
4. **Use fixtures** for deterministic inputs/outputs instead of inline strings when the data is large or reused.
5. **Test happy‐path *and* failure scenarios** – especially for error handling.
6. **Keep tests deterministic and fast** (<100 ms each). Avoid real network or file-system writes.

## Helpful commands

* `vitest --coverage` – show coverage summary in console.
* `vitest run --coverage --reporter=json-summary` – machine-readable summary for CI. 