# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Status

**semver-effect** -- a strict SemVer 2.0.0 implementation built on Effect-TS.
ESM-only, no loose mode, no coercion. Effect-native API with typed errors.

Status: Design phase complete, implementation not yet started.

## Design Documentation

Design docs are in `.claude/design/semver-effect/`:

- `architecture.md` -- System overview, decisions, component structure
- `data-model.md` -- Core types: SemVer, Comparator, Range, VersionDiff
- `parser.md` -- Recursive descent parser, BNF grammar, desugaring
- `error-model.md` -- TaggedError hierarchy with field specs
- `operations.md` -- Comparison, range matching, range algebra, diffing
- `version-cache.md` -- VersionCache service API and internals
- `testing.md` -- Test strategy, coverage targets, Effect patterns

## Commands

### Development

```bash
pnpm run lint              # Check code with Biome
pnpm run lint:fix          # Auto-fix lint issues
pnpm run typecheck         # Type-check all workspaces via Turbo
pnpm run test              # Run all tests
pnpm run test:watch        # Run tests in watch mode
pnpm run test:coverage     # Run tests with coverage report
```

### Building

```bash
pnpm run build             # Build all packages (dev + prod)
pnpm run build:dev         # Build development output only
pnpm run build:prod        # Build production/npm output only
```

### Running a Single Test

```bash
# Run tests for a specific package
pnpm run test -- --filter=@spencerbeggs/ecma-module

# Run a specific test file
pnpm vitest run pkgs/ecma-module/src/index.test.ts
```

## Architecture

### Monorepo Structure

- **Package Manager**: pnpm with workspaces
- **Build Orchestration**: Turbo for caching and task dependencies
- **Packages**: Located in `pkgs/` directory
- **Shared Configs**: Located in `lib/configs/`

### Package Build Pipeline

Each package uses Rslib with dual output:

1. `dist/dev/` - Development build with source maps
2. `dist/npm/` - Production build for npm publishing

Turbo tasks define dependencies: `typecheck` depends on `build` completing first.

### Code Quality

- **Biome**: Unified linting and formatting (replaces ESLint + Prettier)
- **Commitlint**: Enforces conventional commits with DCO signoff
- **Husky Hooks**:
  - `pre-commit`: Runs lint-staged
  - `commit-msg`: Validates commit message format
  - `pre-push`: Runs tests for affected packages

### TypeScript Configuration

- Composite builds with project references
- Strict mode enabled
- ES2022/ES2023 targets
- Import extensions required (`.js` for ESM)

### Testing

- **Framework**: Vitest with v8 coverage
- **Pool**: Uses forks (not threads) for Effect-TS compatibility
- **Config**: `vitest.config.ts` supports project-based filtering via
  `--project` flag

## Conventions

### Source Organization

```text
src/
├── index.ts              (ONLY barrel export -- no other barrels)
├── schemas/              (Schema.TaggedClass types)
├── errors/               (one TaggedError per file, split base pattern)
├── services/             (interface + Context.GenericTag, no implementation)
├── layers/               (Layer implementations -- the "Live" variants)
└── utils/                (pure helpers, parser internals)
__test__/                 (tests, adjacent to src/)
└── utils/                (shared test helpers)
```

### Effect Patterns

- **Services**: `interface Foo` + `Context.GenericTag<Foo>("Foo")` (NOT
  `Context.Tag` class -- avoids un-nameable `_base` in declaration files)
- **Errors**: Split base pattern for api-extractor compatibility:
  `export const FooBase = Data.TaggedError("Foo")` (`@internal`) +
  `export class Foo extends FooBase<{...}> {}`
- **No barrel files** in subdirectories -- all imports go directly to source

### Imports

- Use `.js` extensions for relative imports (ESM requirement)
- Use `node:` protocol for Node.js built-ins
- Separate type imports: `import type { Foo } from './bar.js'`

### Commits

All commits require:

1. Conventional commit format (feat, fix, chore, etc.)
2. DCO signoff: `Signed-off-by: Name <email>`

### Publishing

Packages publish to both GitHub Packages and npm with provenance.
