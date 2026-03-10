---
status: draft
module: semver-effect
category: testing
created: 2026-03-10
updated: 2026-03-10
last-synced: never
completeness: 55
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
5. [Test Fixtures and Vectors](#test-fixtures-and-vectors)
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

**When to reference this document:**

- When writing new test files for any semver-effect module
- When adding parser test cases for grammar edge cases
- When testing Effect services with layers and Ref-based state
- When reviewing coverage reports and identifying gaps

---

## Current State

The project is in early implementation. The test infrastructure is configured
but no test files have been written yet.

### Test Framework Configuration

**Runner:** Vitest with v8 coverage provider

**Pool:** forks (not threads) -- required for Effect-TS compatibility because
Effect uses async hooks and continuation-passing patterns that do not work
reliably in worker threads.

**Config file:** `vitest.config.ts` at the monorepo root, using the shared
`@savvy-web/vitest` configuration package. Projects are defined per-workspace
and coverage uses the v8 provider.

### Planned Test Files

Test files reside in `__test__/` with optional test helpers in
`__test__/utils/`. Tests can also be co-located with their source files.

| File | Module Under Test | Focus |
| :--- | :--- | :--- |
| `SemVer.test.ts` | `src/schemas/SemVer.ts` | Construction, equality, ordering, bumping |
| `Range.test.ts` | `src/schemas/Range.ts` | Parsing, matching, algebra |
| `Comparator.test.ts` | `src/schemas/Comparator.ts` | Operator matching |
| `VersionDiff.test.ts` | `src/schemas/VersionDiff.ts` | Diff operations |
| `SemVerParser.test.ts` | `src/services/SemVerParser.ts` | Grammar edge cases, error positions |
| `VersionCache.test.ts` | `src/services/VersionCache.ts` | Service operations, resolution |
| `errors.test.ts` | `src/errors/*.ts` | Error construction, fields, messages |

### Current Limitations

- No test files exist yet; implementation has not started
- Coverage thresholds have not been configured at the package level
- Integration tests for cross-module interactions are not yet planned

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
suite time.

### Why Structural Error Assertions

**Context:** All errors extend TaggedError with domain-specific fields
(input, position, range, version). Tests need to verify error content.

**Decision:** Assert error structure via `Effect.exit` + `Exit.match` rather
than catching error messages with string matching. This ensures:

- Type safety: the compiler verifies the error type matches
- Field coverage: every error field (position, input, available) is checked
- Refactor safety: renaming an error message does not break tests; changing
  an error field does

### Why Isolated Test Layers

**Context:** VersionCache is backed by `Ref<SortedSet<SemVer>>`. Tests that
share a single Ref instance can interfere with each other.

**Decision:** Each test creates its own Effect Layer with a fresh VersionCache
instance. No test reads or writes state created by another test. This
eliminates ordering dependencies and makes tests parallelizable within a file.

---

## Test Architecture

### Directory Layout

```text
src/
  schemas/
    SemVer.ts              -- version data type (Schema-based)
    Comparator.ts          -- comparator data type
    Range.ts               -- range data type
    VersionDiff.ts         -- version diff data type
  errors/
    {ErrorName}.ts         -- one error class per file
  services/
    SemVerParser.ts        -- parser service interface + GenericTag
    VersionCache.ts        -- cache service interface + GenericTag
  layers/
    SemVerParserLive.ts    -- parser service implementation
    VersionCacheLive.ts    -- cache service implementation
  utils/
    grammar.ts             -- recursive descent grammar rules
    desugar.ts             -- range desugaring logic
    normalize.ts           -- normalization helpers
    compare.ts             -- comparison utilities
    matching.ts            -- range matching utilities
__test__/                    (adjacent to src/, not inside it)
  utils/                   -- shared test helpers
  SemVer.test.ts           -- data type construction and traits
  Range.test.ts            -- range parsing, matching, algebra
  Comparator.test.ts       -- comparator operator matching
  VersionDiff.test.ts      -- diff operations
  SemVerParser.test.ts     -- grammar coverage, error positions
  VersionCache.test.ts     -- service lifecycle, resolution, concurrency
  errors.test.ts           -- error construction and field verification
```

### Test File Structure

Each test file follows a consistent structure:

```typescript
import { describe, it, expect } from "vitest"
import { Effect, Exit, Layer, Ref } from "effect"
// Module imports...

describe("ModuleName", () => {
  describe("feature group", () => {
    it("should behave correctly for valid input", () =>
      Effect.gen(function* () {
        // Arrange
        // Act
        // Assert with expect()
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should produce typed error for invalid input", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(operationThatFails)
        Exit.match(exit, {
          onSuccess: () => expect.unreachable(),
          onFailure: (cause) => {
            // Assert error type and fields
          },
        })
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })
})
```

### Test Helpers

Shared test utilities live in `__test__/utils/` or alongside test files:

- **Test layers:** Pre-configured Layer instances for SemVerParser and
  VersionCache with known state
- **Version fixtures:** Common SemVer instances (e.g., `v1_0_0`, `v2_0_0_rc1`)
  used across multiple test files
- **Assertion helpers:** Wrappers for common Effect exit pattern matching

---

## Test Fixtures and Vectors

### Ported node-semver Strict-Mode Fixtures

We port fixture data from node-semver's test suite, filtering to strict-mode
entries only (skipping all loose-mode entries such as v-prefixed versions).
These fixtures provide battle-tested coverage from the most widely used semver
implementation.

**Fixture files to port:**

| node-semver File | Entries | Notes |
| :--- | :--- | :--- |
| `valid-versions.js` | 23 entries | All strict-compatible; port all |
| `comparisons.js` | 20 of 32 entries | Skip 12 entries with v-prefix |
| `range-include.js` | ~110 entries | Filter to strict-mode only |
| `range-exclude.js` | ~50 entries | Filter to strict-mode only |
| `increments.js` | ~120 entries | All increment/bump test vectors |
| `diff.js` | All entries | Diff type classifications (major, minor, patch, prerelease, etc.) |

**Skipped fixtures:** The `equality.js` fixture is almost entirely loose-mode
(35 of 37 entries use v-prefix or other loose syntax). Skip most of it and
write our own strict equality tests instead.

### SemVer 2.0.0 Spec Test Vectors

We must include ALL test vectors derivable from the SemVer 2.0.0 specification.
These are the canonical correctness tests.

- **9 valid version strings** from spec examples (sections 2, 9, 10)
- **28 ordered-pair precedence tests** from Section 11 (every example pair
  in the spec's precedence rules)
- **4 build-metadata equality pairs** (versions differing only in build
  metadata must compare as equal)
- **20+ invalid version strings** (leading zeros, empty identifiers, missing
  components, non-numeric characters, etc.)
- **15 tricky-but-valid strings** that push parser edge cases:
  `1.0.0--`, `1.0.0-0alpha`, `1.0.0+001`, `1.0.0-0.0.0`, `1.0.0-alpha.-1`
  (these are syntactically valid per the BNF but commonly mishandled)

### Coverage Gaps Beyond node-semver

node-semver's invalid version fixture has only ~10 entries. This is
insufficient for a strict parser. We must fill the following gaps with our own
test vectors:

**Leading zeros (all positions):**

- Major: `01.0.0`, `00.0.0`
- Minor: `1.01.0`, `1.00.0`
- Patch: `1.0.01`, `1.0.00` (note: `0.0.0` is valid, `00.0.0` is not)
- Numeric prerelease: `1.0.0-01`, `1.0.0-alpha.01`

**Empty identifiers:**

- Trailing dot in prerelease: `1.0.0-alpha.`
- Double dots: `1.0.0-alpha..beta`
- Empty after hyphen: `1.0.0-`
- Empty after plus: `1.0.0+`
- Empty between dots in build: `1.0.0+build..meta`

**Invalid characters:**

- Underscore: `1.0.0-alpha_1`
- Unicode: `1.0.0-\u00e9`
- Spaces: `1.0.0 -alpha`, `1 .0.0`
- Special characters: `1.0.0-alpha@1`, `1.0.0-alpha!`

**Structural invalidity:**

- Negative numbers: `-1.0.0`
- Missing components: `1`, `1.0`, `1.0.0.0` (too few or too many)
- v-prefix rejection: `v1.0.0` (strict mode must reject)
- Integer overflow: components beyond `Number.MAX_SAFE_INTEGER`

**Error position tests (our differentiator):** node-semver has ZERO error
position tests. Every invalid input above must assert the exact character
position where the parser detected the error. This is the primary value-add
of our parser's error model over node-semver.

---

## Test Categories

### 1. SemVer 2.0.0 Spec Compliance

The SemVer 2.0.0 specification defines precise rules for version format,
precedence, and comparison. Tests must cover every normative rule.

**Version Format (spec section 2):**

- Valid versions: `1.0.0`, `0.0.0`, `999.999.999`
- Prerelease: `1.0.0-alpha`, `1.0.0-0.3.7`, `1.0.0-x.7.z.92`
- Build metadata: `1.0.0+build`, `1.0.0+20130313144700`
- Combined: `1.0.0-alpha+001`

**Precedence (spec section 11):**

- Major > minor > patch: `2.0.0 > 1.9.9`
- Prerelease lower than release: `1.0.0-alpha < 1.0.0`
- Prerelease ordering: numeric < alphanumeric, shorter < longer
- Build metadata ignored in comparison: `1.0.0+a == 1.0.0+b`

**Edge Cases:**

- Leading zeros in numeric identifiers are forbidden: `01.0.0` must fail
- Empty prerelease identifiers are forbidden: `1.0.0-` must fail
- Prerelease with mixed numeric/string: `1.0.0-alpha.1.beta.2`
- Maximum safe integer boundary for major/minor/patch

### 2. Range Desugaring Correctness

Every range syntactic sugar form must desugar to the correct primitive
comparators.

**Caret ranges:**

| Input | Desugared |
| :--- | :--- |
| `^1.2.3` | `>=1.2.3 <2.0.0` |
| `^0.2.3` | `>=0.2.3 <0.3.0` |
| `^0.0.3` | `>=0.0.3 <0.0.4` |
| `^1.2.x` | `>=1.2.0 <2.0.0` |
| `^0.0.x` | `>=0.0.0 <0.1.0` |
| `^0.0` | `>=0.0.0 <0.1.0` |

**Tilde ranges:**

| Input | Desugared |
| :--- | :--- |
| `~1.2.3` | `>=1.2.3 <1.3.0` |
| `~1.2` | `>=1.2.0 <1.3.0` |
| `~0.2.3` | `>=0.2.3 <0.3.0` |
| `~1` | `>=1.0.0 <2.0.0` |

**X-ranges:**

| Input | Desugared |
| :--- | :--- |
| `*` | `>=0.0.0` |
| `1.x` | `>=1.0.0 <2.0.0` |
| `1.2.x` | `>=1.2.0 <1.3.0` |
| `1.2.*` | `>=1.2.0 <1.3.0` |
| `` (empty) | `>=0.0.0` |

**Hyphen ranges:**

| Input | Desugared |
| :--- | :--- |
| `1.2.3 - 2.3.4` | `>=1.2.3 <=2.3.4` |
| `1.2 - 2.3.4` | `>=1.2.0 <=2.3.4` |
| `1.2.3 - 2.3` | `>=1.2.3 <2.4.0` |
| `1.2.3 - 2` | `>=1.2.3 <3.0.0` |

**Union (OR):**

- `>=1.0.0 <2.0.0 || >=3.0.0` produces two ComparatorSets

### 3. Parser Error Position Accuracy

The recursive descent parser must report the character position where parsing
failed. Tests verify that position values point to the exact character that
violates the grammar.

**Test cases:**

- `"1.2.a"` -- position at `a` (the non-numeric patch)
- `"1.2.3-"` -- position at end (missing prerelease identifier)
- `"01.0.0"` -- position at `0` (leading zero in major)
- `"1.2.3 - "` -- position at end (incomplete hyphen range)
- `"^"` -- position at end (missing version after caret)
- `">=1.0.0 <"` -- position at end (incomplete comparator)

Each test asserts both the error type (e.g., `InvalidVersionError`) and the
`position` field value.

### 4. VersionCache Concurrency

VersionCache is backed by `Ref<SortedSet<SemVer>>`. Tests verify that
concurrent operations produce correct results.

**Scenarios:**

- Concurrent `add` calls: all versions appear in cache
- `load` followed by concurrent `resolve` calls: all resolve correctly
- `remove` during `resolve`: resolution sees consistent snapshot
- Multiple independent VersionCache instances do not interfere

### 5. Edge Cases

**Leading zeros:**

- `01.0.0`, `1.02.0`, `1.0.03` must all fail with InvalidVersionError
- `1.0.0-01` must fail (numeric prerelease with leading zero)
- `1.0.0-alpha.01` must fail

**Empty and whitespace:**

- `""` must fail
- `" 1.0.0"` must fail (no trimming)
- `"1.0.0 "` must fail

**Build metadata in comparisons:**

- `Equal.equals(v("1.0.0+a"), v("1.0.0+b"))` must be `true`
- `Order` comparison of `1.0.0+a` vs `1.0.0+b` must be `0`
- `Hash` of `1.0.0+a` and `1.0.0+b` must be identical

**Prerelease edge cases (critical -- node-semver's #1 pain point):**

Prerelease handling is the single largest source of bugs in node-semver,
accounting for 15+ open issues. Our test suite must comprehensively cover
every prerelease scenario to establish correctness where node-semver
historically fails.

*Comparison and ordering:*

- `1.0.0-0` is valid (numeric zero prerelease)
- `1.0.0-alpha` < `1.0.0-alpha.1` (shorter < longer when prefix matches)
- `1.0.0-alpha.1` < `1.0.0-alpha.beta` (numeric < alphanumeric)
- `1.0.0-1` < `1.0.0-alpha` (numeric < alphanumeric)
- Mixed numeric/alphanumeric comparison across multiple identifiers

*Leading zeros in numeric prerelease identifiers (must reject):*

- `1.0.0-01`, `1.0.0-alpha.01`, `1.0.0-0.01`

*Prerelease matching in ranges (same-tuple policy):*

- `>=1.0.0-alpha` should only match prereleases on `1.0.0`, not `1.0.1-alpha`
- `^1.0.0-beta` desugaring with prerelease-aware bounds
- `~1.0.0-rc.1` desugaring with prerelease-aware bounds

*Caret/tilde desugaring with prerelease:*

- `^1.0.0-alpha` must desugar correctly (lower bound includes prerelease)
- `^0.0.1-beta` edge case (caret on 0.0.x with prerelease)
- `~0.1.0-rc.1` edge case

*Tricky-but-valid prerelease strings:*

- `1.0.0-0alpha` (starts with digit, contains alpha -- this is alphanumeric)
- `1.0.0-0-0` (hyphen within prerelease identifier)
- `1.0.0--` (double-hyphen: empty-looking but valid per BNF)
- `1.0.0-0.0.0.0` (deeply nested numeric identifiers)

---

## Coverage Strategy

### Coverage Provider

v8 provider via Vitest. The v8 provider uses V8's built-in code coverage,
which is faster than istanbul and produces accurate branch coverage for
compiled TypeScript.

### Coverage Targets

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| Statements | 90% | High coverage baseline |
| Branches | 95% | Parser has many branches; near-complete coverage needed |
| Functions | 90% | All public functions must be tested |
| Lines | 90% | Consistent with statement coverage |

Branch coverage is the most critical metric because the recursive descent
parser contains numerous conditional paths for grammar rules, error recovery,
and range desugaring. Missing a branch in parser code likely means missing a
spec compliance case.

### Coverage Priorities

**High priority (95%+ branch coverage):**

- `src/utils/grammar.ts` -- every grammar rule path
- `src/utils/desugar.ts` -- every desugaring case
- `src/errors/*.ts` -- every error constructor

**Standard priority (90%+ coverage):**

- `src/schemas/SemVer.ts` -- construction, bump operations
- `src/schemas/Range.ts` -- matching, algebra
- `src/schemas/Comparator.ts` -- operator matching
- `src/utils/compare.ts` -- ordering logic

**Moderate priority (80%+ coverage):**

- `src/services/VersionCache.ts` -- service interface
- `src/layers/VersionCacheLive.ts` -- service operations (some navigation
  methods are Phase 3 features)
- `src/utils/normalize.ts` -- normalization helpers
- `src/utils/matching.ts` -- range matching utilities

### Excluded from Coverage

- `src/index.ts` -- barrel re-exports only, no logic
- Type-only files and type guard declarations

---

## Effect Testing Patterns

### Running Effect Tests in Vitest

Every test that involves Effect must ultimately call `Effect.runPromise` (or
`Effect.runSync` for pure synchronous Effects) to bridge into Vitest's
promise-based assertion model.

```typescript
it("parses a valid version", () =>
  Effect.gen(function* () {
    const parser = yield* SemVerParser
    const v = yield* parser.parseVersion("1.2.3")
    expect(v.major).toBe(1)
    expect(v.minor).toBe(2)
    expect(v.patch).toBe(3)
  }).pipe(Effect.provide(SemVerParserLive), Effect.runPromise))

// SemVerParserLive is imported from src/layers/SemVerParserLive.ts
```

### Testing Effect Services with Test Layers

Services are tested by providing a Layer that constructs a fresh service
instance per test. This keeps tests isolated.

```typescript
const TestParserLayer = SemVerParserLive

const TestCacheLayer = Layer.effect(
  VersionCache,
  Effect.gen(function* () {
    const ref = yield* Ref.make(SortedSet.empty<SemVer>())
    return VersionCache.make(ref)
  })
)
```

For tests that need pre-populated state:

```typescript
const preloadedCacheLayer = (versions: ReadonlyArray<string>) =>
  Layer.effect(
    VersionCache,
    Effect.gen(function* () {
      const cache = yield* VersionCache.make()
      yield* cache.load(versions.map(parseVersionUnsafe))
      return cache
    })
  )
```

### Asserting Typed Errors via Effect.either

The cleanest pattern for error assertions uses `Effect.either`, which captures
the error channel as an `Either<A, E>` without requiring Cause/Option
unwrapping. This is preferred over the more verbose `Effect.exit` + `Cause`
extraction pattern.

```typescript
it("rejects leading zeros", async () => {
  const result = await Effect.runPromise(
    parser.parseVersion("01.0.0").pipe(
      Effect.either,
      Effect.provide(TestParserLayer)
    )
  )
  expect(result._tag).toBe("Left")
  if (result._tag === "Left") {
    expect(result.left._tag).toBe("InvalidVersionError")
    expect(result.left.input).toBe("01.0.0")
    expect(result.left.position).toBe(0)
  }
})
```

### Testing with Ref-Based State

VersionCache tests use Ref to verify state transitions:

```typescript
it("adds a version to the cache", () =>
  Effect.gen(function* () {
    const cache = yield* VersionCache
    yield* cache.add(v1_0_0)
    const versions = yield* cache.versions
    expect(versions).toHaveLength(1)
    expect(Equal.equals(versions[0], v1_0_0)).toBe(true)
  }).pipe(Effect.provide(TestCacheLayer), Effect.runPromise))
```

For concurrency tests, use `Effect.all` with concurrent option:

```typescript
it("handles concurrent adds", () =>
  Effect.gen(function* () {
    const cache = yield* VersionCache
    yield* Effect.all(
      [cache.add(v1_0_0), cache.add(v2_0_0), cache.add(v3_0_0)],
      { concurrency: "unbounded" }
    )
    const versions = yield* cache.versions
    expect(versions).toHaveLength(3)
  }).pipe(Effect.provide(TestCacheLayer), Effect.runPromise))
```

### Testing Order and Equal Instances

Order and Equal are tested via Effect's standard trait interfaces:

```typescript
import { Order as Ord, Equal } from "effect"

it("orders versions by precedence", () => {
  const sorted = [v2_0_0, v1_0_0, v1_1_0].sort(SemVerOrder)
  expect(sorted.map(String)).toEqual(["1.0.0", "1.1.0", "2.0.0"])
})

it("treats build metadata as equal", () => {
  expect(Equal.equals(v1_0_0_buildA, v1_0_0_buildB)).toBe(true)
})

it("produces identical hashes ignoring build", () => {
  expect(Hash.hash(v1_0_0_buildA)).toBe(Hash.hash(v1_0_0_buildB))
})
```

---

## Related Documentation

**Design Spec:**

- [semver-effect Design Spec](../../../docs/specs/semver-effect-design.md) --
  Approved specification with full API surface and error model

**Architecture:**

- [architecture.md](architecture.md) -- System architecture and component
  overview

**Monorepo Testing Configuration:**

- `vitest.config.ts` at the monorepo root defines the shared test runner
  configuration

---

**Document Status:** Draft -- covers test architecture, categories, coverage
strategy, and Effect testing patterns based on the approved design spec. Will
be updated as test files are implemented and coverage data becomes available.

**Next Steps:** Begin implementing `errors.test.ts` and `SemVer.test.ts` in
`__test__/` as the first test files. Update coverage targets once baseline measurements are
available.
