# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Status

**semver-effect** -- a strict SemVer 2.0.0 implementation built on Effect-TS.
ESM-only, no loose mode, no coercion. Effect-native API with typed errors.
650 tests passing, full SemVer 2.0.0 spec compliance.

## Design Documentation

**For system architecture and component structure:**
@ `./.claude/design/semver-effect/architecture.md`
Load when making architectural decisions or understanding component relationships.

**For core data types (SemVer, Comparator, Range, VersionDiff):**
@ `./.claude/design/semver-effect/data-model.md`
Load when modifying schemas, changing Data.TaggedClass patterns, or debugging equality/hashing.

**For the recursive descent parser:**
@ `./.claude/design/semver-effect/parser.md`
Load when modifying parsing, BNF grammar, or desugaring logic.

**For error types and hierarchy:**
@ `./.claude/design/semver-effect/error-model.md`
Load when adding or modifying TaggedError types.

**For comparison, matching, algebra, and diff operations:**
@ `./.claude/design/semver-effect/operations.md`
Load when modifying comparison, range matching, range algebra, or diff utilities.

**For the VersionCache service:**
@ `./.claude/design/semver-effect/version-cache.md`
Load when modifying the cache service API or layer implementation.

**For test strategy and coverage:**
@ `./.claude/design/semver-effect/testing.md`
Load when writing or restructuring tests.

**For SemVer 2.0.0 spec compliance details:**
@ `./.claude/design/semver-effect/semver-compliance.md`
Load when verifying spec compliance or handling edge cases.

**For node-semver divergences and migration:**
@ `./.claude/design/semver-effect/node-semver-divergences.md`
Load when comparing behavior with node-semver or writing migration docs.

**Research reference material** (pre-implementation analysis, historical context):
@ `./.claude/design/semver-effect/research/`
Load when investigating design rationale or reviewing prior analysis.

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
# Run a specific test file
pnpm vitest run __test__/SemVer.test.ts
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
├── schemas/              (Data.TaggedClass types)
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
- **Schemas**: Split base pattern for api-extractor compatibility:
  `export const FooBase = Data.TaggedClass("Foo")` (`@internal`) +
  `export class Foo extends FooBase<{...}> {}`
- **Errors**: Same split base pattern with `Data.TaggedError`:
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
The `"private": true` in `package.json` is transformed by the build process
(rslib-builder) based on `publishConfig.access` -- it is not manually toggled.

## Tooling

- **Biome**: Unified linting and formatting (`biome.jsonc` at root)
- **Commitlint**: Conventional commits with DCO signoff (`@savvy-web/commitlint`)
- **Husky**: Git hooks (`pre-commit`, `commit-msg`, `pre-push`)
- **lint-staged**: Runs Biome, markdownlint, tsgo on staged files
- **markdownlint**: Markdown linting (`lib/configs/.markdownlint-cli2.jsonc`)
- **Turbo**: Build orchestration with caching
- **Rslib**: Library bundler with dual dev/npm output and api-extractor
- **Vitest**: Test framework with v8 coverage, forks pool
- **tsgo**: Go-based TypeScript compiler (preferred over tsc)
