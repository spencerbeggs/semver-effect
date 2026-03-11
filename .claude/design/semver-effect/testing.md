---
status: current
module: semver-effect
category: testing
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 95
related:
  - architecture.md
  - data-model.md
  - parser.md
  - error-model.md
  - operations.md
  - version-cache.md
dependencies: []
---

# Semver Effect - Testing Strategy

Comprehensive testing strategy for the semver-effect package, covering spec
compliance, Effect service testing patterns, and edge case coverage for the
recursive descent parser and VersionCache service.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Test Architecture](#test-architecture)
5. [Test Fixtures](#test-fixtures)
6. [Test Categories](#test-categories)
7. [Coverage Strategy](#coverage-strategy)
8. [Effect Testing Patterns](#effect-testing-patterns)
9. [Related Documentation](#related-documentation)

---

## Overview

The testing strategy for semver-effect is driven by two primary concerns:
strict SemVer 2.0.0 spec compliance and correct integration with the Effect
type system. Every public function returns an Effect, so tests must verify
both success and typed error channels. The recursive descent parser demands
thorough edge case coverage with precise error position assertions. The
VersionCache service requires concurrency-safe testing against Ref-backed
state.

**Key Testing Principles:**

- Every parser edge case from the SemVer 2.0.0 BNF grammar has a corresponding
  test
- Typed errors are asserted structurally, not just by message string
- Effect services are tested with isolated test layers, never shared mutable
  state
- Coverage targets emphasize branch coverage in parser code paths
- Tests run with Vitest forks pool for Effect-TS compatibility

---

## Current State

The test suite is fully implemented with 650 tests across 16 test files and
3920 lines of test code. All tests pass.

### Test Framework Configuration

**Runner:** Vitest with v8 coverage provider

**Pool:** forks (not threads) -- required for Effect-TS compatibility because
Effect uses async hooks and continuation-passing patterns that do not work
reliably in worker threads.

**Config file:** `vitest.config.ts` at the monorepo root, using the shared
`@savvy-web/vitest` configuration package. Projects are defined per-workspace
and coverage uses the v8 provider.

### Test File Inventory

| File | Tests | Lines | Module Under Test |
| :--- | :--- | :--- | :--- |
| `spec-compliance.test.ts` | 166 | 71 | Spec vectors via fixtures |
| `coverage.test.ts` | 111 | 768 | Cross-module edge cases |
| `errors.test.ts` | 63 | 406 | All 10 error classes |
| `compare.test.ts` | 48 | 278 | Comparison + collection ops |
| `schemas.test.ts` | 42 | 408 | SemVer, Comparator, Range, VersionDiff |
| `parseRange.test.ts` | 36 | 239 | Range parsing + desugaring |
| `VersionCache.test.ts` | 34 | 424 | Cache service lifecycle |
| `parseVersion.test.ts` | 34 | 207 | Version parsing + rejection |
| `matching.test.ts` | 19 | 129 | Range satisfaction |
| `order.test.ts` | 18 | 119 | SemVerOrder + SemVerOrderWithBuild |
| `algebra.test.ts` | 16 | 148 | Union, intersect, subset, etc. |
| `SemVerParser.test.ts` | 12 | 114 | Parser service via Layer |
| `diff.test.ts` | 10 | 86 | Version diffing |
| `bump.test.ts` | 7+ | 107 | Bump operations |
| `prettyPrint.test.ts` | 7 | 77 | Match.exhaustive printer |
| `SemVer.test.ts` | 27+ | 339 | SemVer construction + traits |
| **Total** | **650** | **3920** | |

### Fixture Files

Three fixture files in `__test__/fixtures/` provide structured test vectors:

| File | Contents |
| :--- | :--- |
| `versions.ts` | `validVersions`, `invalidVersions`, `comparisonPairs` arrays |
| `ranges.ts` | `rangeTests` array with range-satisfaction test cases |
| `increments.ts` | `incrementTests` array with bump operation vectors |

Fixtures are derived from node-semver's test suite, filtered to strict-mode
entries only (all loose-mode entries such as v-prefixed versions are excluded).

---

## Rationale

### Why Vitest with Forks Pool

**Context:** Effect-TS uses fiber-based concurrency with async hooks and
continuation-passing internals. Vitest's default threads pool uses Node.js
worker_threads, which do not support all async hook behaviors that Effect
relies on.

**Decision:** Use `pool: "forks"` to run each test file in a child process
via `child_process.fork()`. This gives each test file its own V8 isolate
with full async hook support, matching how Effect runs in production.

**Trade-off:** Fork pool is slower than threads pool due to process startup
overhead. This is acceptable because semver-effect tests are fast unit tests
with no I/O, so the per-process overhead is negligible relative to total
suite time (692ms total duration).

### Why Structural Error Assertions

**Context:** All errors extend TaggedError with domain-specific fields
(input, position, range, version). Tests need to verify error content.

**Decision:** Assert error structure via `Effect.either` or `Effect.exit` +
`Exit.match` rather than catching error messages with string matching. This
ensures type safety, field coverage, and refactor safety.

### Why Isolated Test Layers

**Context:** VersionCache is backed by `Ref<SortedSet<SemVer>>`. Tests that
share a single Ref instance can interfere with each other.

**Decision:** Each test creates its own Effect Layer with a fresh VersionCache
instance. No test reads or writes state created by another test. This
eliminates ordering dependencies and makes tests parallelizable within a file.

### Why Two Spec Compliance Approaches

The test suite uses two complementary approaches:

1. **`spec-compliance.test.ts`** -- Data-driven tests using `it.each` with
   fixture arrays. Covers valid versions, invalid versions, comparison pairs,
   range satisfaction, and bump operations. High coverage breadth with minimal
   code.

2. **`coverage.test.ts`** -- Targeted tests for edge cases, cross-module
   interactions, and code paths not covered by fixtures. Focuses on depth:
   schema construction, algebra edge cases, VersionCache navigation, and
   prettyPrint exhaustiveness.

---

## Test Architecture

### Directory Layout

```text
__test__/
  fixtures/
    versions.ts              -- valid/invalid version vectors, comparison pairs
    ranges.ts                -- range satisfaction test cases
    increments.ts            -- bump operation test vectors
  algebra.test.ts            -- range algebra (union, intersect, subset, etc.)
  bump.test.ts               -- version bump operations
  compare.test.ts            -- comparison helpers and collection operations
  coverage.test.ts           -- cross-module edge cases and deep coverage
  diff.test.ts               -- version diffing
  errors.test.ts             -- all 10 error class construction + fields
  matching.test.ts           -- range satisfaction logic
  order.test.ts              -- SemVerOrder and SemVerOrderWithBuild
  parseRange.test.ts         -- range parsing and desugaring
  parseVersion.test.ts       -- version parsing and rejection
  prettyPrint.test.ts        -- Match.exhaustive printer
  schemas.test.ts            -- Schema.TaggedClass construction + traits
  SemVer.test.ts             -- SemVer data type (Equal, Hash, toString, toJSON)
  SemVerParser.test.ts       -- parser service via Layer composition
  spec-compliance.test.ts    -- data-driven spec compliance via fixtures
  VersionCache.test.ts       -- cache service lifecycle and operations
```

### Test File Organization

Each test file maps to a specific source module or concern:

- **Schema tests** (`schemas.test.ts`, `SemVer.test.ts`): Construction,
  `disableValidation`, traits (Equal, Hash, Inspectable), toString/toJSON
- **Parser tests** (`parseVersion.test.ts`, `parseRange.test.ts`,
  `SemVerParser.test.ts`): Grammar correctness, error positions, desugaring
- **Operation tests** (`compare.test.ts`, `matching.test.ts`, `algebra.test.ts`,
  `bump.test.ts`, `diff.test.ts`, `order.test.ts`, `prettyPrint.test.ts`):
  Pure functions and effectful operations
- **Service tests** (`VersionCache.test.ts`): Layer-based service testing
- **Error tests** (`errors.test.ts`): All 10 error classes with field and
  message verification
- **Spec tests** (`spec-compliance.test.ts`): Fixture-driven compliance suite
- **Coverage tests** (`coverage.test.ts`): Gap-filling edge cases

---

## Test Fixtures

### Fixture Design

Fixture data is stored as typed TypeScript arrays in `__test__/fixtures/`.
This approach provides type checking on fixture data, IDE autocomplete for
fixture fields, and easy `it.each` integration with Vitest.

### versions.ts

Contains three exports:

- `validVersions: ReadonlyArray<string>` -- 30+ valid SemVer strings including
  spec examples and tricky-but-valid edge cases (`1.0.0--`, `1.0.0-0alpha`,
  `1.0.0+001`, `1.0.0-0-0`)
- `invalidVersions: ReadonlyArray<string>` -- Invalid version strings covering
  leading zeros, empty identifiers, invalid characters, v-prefix, missing
  components
- `comparisonPairs` -- Ordered pairs for precedence verification

### ranges.ts

Contains `rangeTests` -- range satisfaction test cases ported from node-semver,
filtered to strict-mode only. Each entry specifies a range string, a version
string, and the expected satisfaction result.

### increments.ts

Contains `incrementTests` -- bump operation vectors ported from node-semver.
Each entry specifies an input version, bump type, and expected output version.

---

## Test Categories

### 1. SemVer 2.0.0 Spec Compliance

Driven by `spec-compliance.test.ts` using fixture data. Covers:

- **Valid versions:** All 9 spec examples plus 20+ additional valid strings
- **Invalid versions:** Leading zeros, empty identifiers, invalid characters,
  structural invalidity
- **Precedence:** The 28 ordered pairs from Section 11 plus additional pairs
- **Build metadata equality:** Versions differing only in build are equal
- **Roundtrip parsing:** `parse(v.toString())` produces equivalent version

### 2. Range Desugaring Correctness

Covered by `parseRange.test.ts`. Every range sugar form is tested:

- Caret ranges (`^1.2.3`, `^0.2.3`, `^0.0.3`, `^1.2.x`, `^0.0.x`, `^0.0`)
- Tilde ranges (`~1.2.3`, `~1.2`, `~0.2.3`, `~1`)
- X-ranges (`*`, `1.x`, `1.2.x`, `1.2.*`, empty string)
- Hyphen ranges (`1.2.3 - 2.3.4`, `1.2 - 2.3.4`, `1.2.3 - 2.3`, `1.2.3 - 2`)
- X-ranges with operators (`>1.x`, `>=1.x`, `<1.x`, `<=1.x`)
- OR unions (`>=1.0.0 <2.0.0 || >=3.0.0`)

### 3. Parser Error Position Accuracy

Covered by `parseVersion.test.ts` and `parseRange.test.ts`. Tests assert
both the error type and the `position` field value:

- `"01.0.0"` -- position at leading zero
- `"1.0.0-"` -- position at end (missing prerelease identifier)
- `"v1.0.0"` -- position 0 (v-prefix rejected)
- `">=1.02.3"` -- position at leading zero in minor

### 4. VersionCache Lifecycle

Covered by `VersionCache.test.ts`. Tests use isolated Layer instances:

- Mutation operations: load, add, remove (all infallible)
- Query operations: versions, latest, oldest (EmptyCacheError on empty)
- Resolution: resolve, resolveString, filter
- Grouping: groupBy, latestByMajor, latestByMinor
- Navigation: diff, next, prev (VersionNotFoundError for missing)
- Concurrent operations: concurrent adds all succeed

### 5. Error Class Construction

Covered by `errors.test.ts`. Every error class is tested for:

- Construction with all fields
- `_tag` discriminator value
- `message` getter output format
- Field accessibility (input, position, range, version, etc.)
- Structural equality between identical errors

### 6. Schema Traits

Covered by `schemas.test.ts` and `SemVer.test.ts`:

- `Equal.equals` excludes build metadata
- `Hash.hash` is consistent with Equal (identical for versions differing only in build)
- `toString()` includes all components (prerelease + build)
- `toJSON()` produces structured representation
- `nodejs.util.inspect.custom` is implemented
- `disableValidation` skips schema checks for trusted construction

### 7. Cross-Module Edge Cases

Covered by `coverage.test.ts`. Targets specific code paths:

- Algebra edge cases (intersection failures, empty results)
- SemVerOrderWithBuild comparison
- bumpPrerelease with and without identifier
- minSatisfying over version arrays
- Schema construction edge cases
- Comparator and Range toString formatting

---

## Coverage Strategy

### Coverage Provider

v8 provider via Vitest. The v8 provider uses V8's built-in code coverage,
which is faster than istanbul and produces accurate branch coverage for
compiled TypeScript.

### Coverage Priorities

**High priority (parser and desugaring):**

- `src/utils/grammar.ts` -- every grammar rule path
- `src/utils/desugar.ts` -- every desugaring case
- `src/errors/*.ts` -- every error constructor and message getter

**Standard priority (core operations):**

- `src/schemas/SemVer.ts` -- construction, Equal, Hash, Inspectable
- `src/utils/compare.ts` -- ordering and collection operations
- `src/utils/matching.ts` -- range satisfaction logic
- `src/utils/algebra.ts` -- range algebra operations
- `src/utils/bump.ts` -- bump operations
- `src/utils/diff.ts` -- version diffing

**Service priority:**

- `src/layers/VersionCacheLive.ts` -- all cache operations
- `src/layers/SemVerParserLive.ts` -- parser layer
- `src/utils/order.ts` -- Order instances
- `src/utils/normalize.ts` -- normalization helpers

### Excluded from Coverage

- `src/index.ts` -- barrel re-exports only, no logic
- Type-only files and type guard declarations

---

## Effect Testing Patterns

### Running Effect Tests in Vitest

Tests use two patterns depending on whether the operation requires services:

**Standalone functions (no Layer required):**

```typescript
it("parses a valid version", () => {
  const v = Effect.runSync(parseValidSemVer("1.2.3"))
  expect(v.major).toBe(1)
})
```

**Service-dependent operations (Layer required):**

```typescript
it("resolves a range", () =>
  Effect.gen(function* () {
    const cache = yield* VersionCache
    yield* cache.load(versions)
    const result = yield* cache.resolve(range)
    expect(result.major).toBe(1)
  }).pipe(
    Effect.provide(Layer.merge(VersionCacheLive, SemVerParserLive)),
    Effect.runPromise,
  ))
```

### Testing Typed Errors via Effect.either

The cleanest pattern for error assertions uses `Effect.either`:

```typescript
it("rejects leading zeros", () => {
  const result = Effect.runSync(
    parseValidSemVer("01.0.0").pipe(Effect.either)
  )
  expect(result._tag).toBe("Left")
  if (result._tag === "Left") {
    expect(result.left._tag).toBe("InvalidVersionError")
    expect(result.left.input).toBe("01.0.0")
    expect(result.left.position).toBe(0)
  }
})
```

### Fixture-Driven Tests via it.each

The `spec-compliance.test.ts` file uses `it.each` with fixture arrays for
data-driven testing:

```typescript
it.each(validVersions)("parses %s", (input) => {
  expect(() => parse(input)).not.toThrow()
})

it.each(invalidVersions)("rejects %s", (input) => {
  expect(() => parse(input)).toThrow()
})
```

### Direct Construction with disableValidation

Tests that need specific SemVer instances without parsing use direct
construction:

```typescript
const v = (major: number, minor: number, patch: number,
           prerelease: ReadonlyArray<string | number> = [],
           build: ReadonlyArray<string> = []) =>
  new SemVer({ major, minor, patch,
               prerelease: [...prerelease],
               build: [...build] },
             { disableValidation: true })
```

### Testing Order and Equal Instances

```typescript
it("orders versions by precedence", () => {
  expect(SemVerOrder(parse("1.0.0"), parse("2.0.0"))).toBe(-1)
})

it("treats build metadata as equal", () => {
  expect(Equal.equals(parse("1.0.0+a"), parse("1.0.0+b"))).toBe(true)
})

it("produces identical hashes ignoring build", () => {
  expect(Hash.hash(parse("1.0.0+a"))).toBe(Hash.hash(parse("1.0.0+b")))
})
```

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture and component
  overview
- [error-model.md](error-model.md) -- Error types tested in errors.test.ts
- [parser.md](parser.md) -- Parser design tested in parseVersion/parseRange
- [operations.md](operations.md) -- Operations tested in compare/matching/etc.
- [version-cache.md](version-cache.md) -- Cache service tested in VersionCache

---

**Document Status:** Current -- covers the complete test suite as implemented.
650 tests across 16 files, 3920 lines of test code. All tests pass. Fixture
data ported from node-semver (strict-mode only).
