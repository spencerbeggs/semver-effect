---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 95
related:
  - data-model.md
  - parser.md
  - error-model.md
  - operations.md
  - version-cache.md
  - testing.md
  - semver-compliance.md
  - node-semver-divergences.md
dependencies: []
---

# Semver Effect - Architecture

Strict SemVer 2.0.0 implementation built on Effect, providing typed parsing,
range algebra, and version cache services.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [System Architecture](#system-architecture)
5. [Data Flow](#data-flow)
6. [Integration Points](#integration-points)
7. [Testing Strategy](#testing-strategy)
8. [Future Enhancements](#future-enhancements)
9. [Related Documentation](#related-documentation)

---

## Overview

semver-effect is a strict SemVer 2.0.0 implementation that replaces node-semver
for Effect-native TypeScript applications. Every function returns an Effect,
invalid input produces typed errors (never null), and all data types are
immutable Schema.TaggedClass instances.

**Key Design Principles:**

- Strict SemVer 2.0.0 grammar only -- no loose mode, no coercion, no v-prefix tolerance
- Effect-native API: all parsing operations return Effect with typed error channels
- Rich error model via TaggedError with positional parse info
- Immutable data types via Schema.TaggedClass with Equal, Order, Hash, Inspectable
- Service-based architecture: SemVerParser and VersionCache as Effect services
- Pure utility functions for comparison, matching, bumping, and diffing

**When to reference this document:**

- When understanding the overall module structure and dependency graph
- When reasoning about the service pattern (interface + GenericTag + Layer)
- When deciding where new functionality should live
- When understanding the build pipeline and export surface

---

## Current State

### Implementation Status

The implementation is **complete**. All core modules are implemented, tested,
and working. The package has 476 tests across 19 test files with high branch
coverage.

#### Component 1: Core Data Types (schemas/)

**Location:** `src/schemas/SemVer.ts`, `src/schemas/Range.ts`,
`src/schemas/Comparator.ts`, `src/schemas/VersionDiff.ts`

**Status:** Implemented and tested.

**Responsibilities:**

- SemVer: major/minor/patch/prerelease/build with custom Equal, Order, Hash,
  Inspectable (toString, toJSON, nodejs.util.inspect.custom)
- Comparator: operator + version pairing with toString
- ComparatorSet: type alias for `ReadonlyArray<Comparator>` (not a class)
- Range: OR of ComparatorSets with toString
- VersionDiff: structured diff between two versions with type classification

#### Component 2: Parser (services/ + layers/ + utils/)

**Location:** `src/services/SemVerParser.ts` (interface + tag),
`src/layers/SemVerParserLive.ts` (implementation),
`src/utils/grammar.ts` (recursive descent parser),
`src/utils/desugar.ts` (range desugaring),
`src/utils/normalize.ts` (range normalization),
`src/utils/parseRange.ts` (convenience wrapper)

**Status:** Implemented and tested.

**Responsibilities:**

- parseVersion (exported as `parseVersion`): string to SemVer with precise error positions
- parseRange: string to Range with desugaring and normalization
- parseComparator (exported as `parseComparator`): string to Comparator
- Hand-written recursive descent PEG parser, character-by-character walk
- All syntactic sugar desugared during parsing

#### Component 3: Operations (utils/)

**Location:** `src/utils/compare.ts`, `src/utils/matching.ts`,
`src/utils/algebra.ts`, `src/utils/diff.ts`, `src/utils/bump.ts`,
`src/utils/order.ts`, `src/utils/prettyPrint.ts`

**Status:** Implemented and tested.

**Responsibilities:**

- Comparison: compare, equal, gt, gte, lt, lte, neq, sort, rsort, max, min
- Matching: satisfies, filter, maxSatisfying, minSatisfying
- Algebra: intersect, union, simplify, isSubset, equivalent
- Diffing: diff (produces VersionDiff)
- Bumping: bumpMajor, bumpMinor, bumpPatch, bumpPrerelease, bumpRelease
- Ordering: SemVerOrder, SemVerOrderWithBuild
- Pretty-printing: prettyPrint via Match.exhaustive

#### Component 4: VersionCache (services/ + layers/)

**Location:** `src/services/VersionCache.ts` (interface + tag),
`src/layers/VersionCacheLive.ts` (implementation)

**Status:** Implemented and tested.

**Responsibilities:**

- Load, add, remove versions (infallible mutation)
- Query: versions, latest, oldest
- Resolution: resolve, resolveString, filter
- Grouping: groupBy, latestByMajor, latestByMinor
- Navigation: diff, next, prev
- Backed by `Ref<SortedSet<SemVer>>`

#### Component 5: Error Model (errors/)

**Location:** `src/errors/` (one file per error class)

**Status:** Implemented and tested. 10 error classes total.

**Responsibilities:**

- Parsing errors: InvalidVersionError, InvalidRangeError,
  InvalidComparatorError, InvalidPrereleaseError
- Resolution errors: UnsatisfiedRangeError, VersionNotFoundError,
  EmptyCacheError
- Constraint errors: UnsatisfiableConstraintError, InvalidBumpError
- Fetch errors: VersionFetchError

#### Component 6: VersionFetcher (services/)

**Location:** `src/services/VersionFetcher.ts` (interface + tag only)

**Status:** Interface defined. No concrete implementation provided (by design).

**Responsibilities:**

- Abstract interface for fetching versions from external sources
- Consumers provide their own Layer implementations

### Architecture Diagram

```text
                     Public API (src/index.ts -- only barrel)
                              |
       +-------------+-------+-------+-------------+
       |              |               |             |
   schemas/       services/       layers/       errors/
   SemVer.ts      SemVerParser.ts SemVerParser  InvalidVersionError.ts
   Range.ts       VersionCache.ts  Live.ts      InvalidRangeError.ts
   Comparator.ts  VersionFetcher  VersionCache  InvalidComparatorError.ts
   VersionDiff.ts  (interface +    Live.ts      InvalidPrereleaseError.ts
       |            GenericTag)                  UnsatisfiedRangeError.ts
       |                |                       VersionNotFoundError.ts
       |            utils/                      EmptyCacheError.ts
       |            grammar.ts                  UnsatisfiableConstraintError.ts
       |            desugar.ts                  InvalidBumpError.ts
       |            normalize.ts                VersionFetchError.ts
       |            compare.ts
       |            matching.ts
       |            algebra.ts
       |            diff.ts
       |            bump.ts
       |            order.ts
       |            parseRange.ts
       |            prettyPrint.ts
       |
  Schema.TaggedClass
  Equal + Order + Hash + Inspectable
```

---

## Rationale

### Architectural Decisions

#### Decision 1: Effect-Native API (No Sync Wrapper)

**Context:** Need SemVer parsing and range matching for Effect applications.

**Options considered:**

1. **Effect-native only (Chosen):**
   - Pros: Clean typed error channels, composable with Effect pipelines
   - Cons: Cannot be used outside Effect ecosystem
   - Why chosen: Target audience is Effect-TS users; sync wrapper may come later

2. **Dual API (Effect + sync):**
   - Pros: Broader audience
   - Cons: API surface doubles, error handling diverges
   - Why rejected: Complexity not justified for initial release

#### Decision 2: Recursive Descent Parser (No Regex)

**Context:** Need to parse SemVer version strings and range expressions.

**Options considered:**

1. **Recursive descent (Chosen):**
   - Pros: Precise error positions, clean grammar mapping, no backtracking
   - Cons: More code than regex
   - Why chosen: Better errors justify the extra code

2. **Regex-based parsing:**
   - Pros: Less code, well-known patterns
   - Cons: Poor error messages, hard to maintain complex range grammar
   - Why rejected: Error quality is a core goal

#### Decision 3: Schema.TaggedClass for Data Types

**Context:** Need immutable, serializable version data types.

**Options considered:**

1. **Schema.TaggedClass (Chosen):**
   - Pros: Built-in serialization, pattern matching via _tag
   - Cons: Effect dependency for data types
   - Why chosen: Integrates naturally with Effect ecosystem

2. **Plain interfaces + custom Equal:**
   - Pros: Lighter weight
   - Cons: Manual Equal/Hash/serialization
   - Why rejected: Schema.TaggedClass provides needed traits

**Implementation note:** Custom Equal and Hash overrides are mandatory on
SemVer because the default Data.Class equality does shallow reference
comparison on arrays, and build metadata must be excluded from both
equality and hashing per the SemVer spec.

### Design Patterns Used

#### Pattern 1: Interface + GenericTag Service Pattern

- **Where used:** SemVerParser, VersionCache, VersionFetcher
- **Why used:** Dependency injection, testability, multiple instances
- **Implementation:** Interface + `Context.GenericTag` in `services/`, Layer in
  `layers/`. GenericTag avoids un-nameable `_base` types that break
  api-extractor declaration bundling when re-exported via `export *`.

#### Pattern 2: Split Base for TaggedError

- **Where used:** All 10 error types in `errors/` (one file per error)
- **Why used:** Typed error channels, pattern matching, rich context
- **Implementation:** Each error file exports a named `*Base` constant
  (`Data.TaggedError(...)`) and a class extending it. The split base gives
  api-extractor a stable reference instead of an un-nameable inline call.
  The `*Base` export is marked `@internal`.

#### Pattern 3: No Barrel Files (Single Index)

- **Where used:** Entire codebase
- **Why used:** Avoids circular imports, improves tree-shaking
- **Implementation:** Only `src/index.ts` is a barrel. All other files
  import directly from source paths. No `schemas/index.ts`, no
  `errors/index.ts`.

#### Pattern 4: Dual API (data-first + data-last)

- **Where used:** All binary pure operations (compare, satisfies, filter, etc.)
- **Why used:** Effect ecosystem convention, pipe ergonomics
- **Implementation:** Uses `Function.dual(2, ...)` for all binary operations.
  Enables both `satisfies(version, range)` and `pipe(version, satisfies(range))`.

#### Pattern 5: disableValidation for Trusted Internals

- **Where used:** Parser output, bump operations, desugar, normalize
- **Why used:** Avoids double validation on hot paths
- **Implementation:** `new SemVer({...}, { disableValidation: true })` when
  constructing from already-validated data inside the parser and internal
  utility functions.

---

## System Architecture

### Source Layout

```text
src/
├── index.ts                  (only barrel export)
├── schemas/
│   ├── SemVer.ts
│   ├── Comparator.ts
│   ├── Range.ts              (also exports ComparatorSet type alias)
│   └── VersionDiff.ts
├── errors/
│   ├── InvalidVersionError.ts
│   ├── InvalidRangeError.ts
│   ├── InvalidComparatorError.ts
│   ├── InvalidPrereleaseError.ts
│   ├── UnsatisfiedRangeError.ts
│   ├── VersionNotFoundError.ts
│   ├── EmptyCacheError.ts
│   ├── UnsatisfiableConstraintError.ts
│   ├── InvalidBumpError.ts
│   └── VersionFetchError.ts
├── services/
│   ├── SemVerParser.ts       (interface + GenericTag)
│   ├── VersionCache.ts       (interface + GenericTag)
│   └── VersionFetcher.ts     (interface + GenericTag)
├── layers/
│   ├── SemVerParserLive.ts
│   └── VersionCacheLive.ts
└── utils/
    ├── grammar.ts            (recursive descent parser)
    ├── desugar.ts            (range sugar -> primitive comparators)
    ├── normalize.ts          (range normalization)
    ├── parseRange.ts         (convenience parseRange wrapper)
    ├── compare.ts            (comparison helpers using dual)
    ├── matching.ts           (range matching logic)
    ├── algebra.ts            (intersect, union, simplify, isSubset, equivalent)
    ├── diff.ts               (structured version diffing)
    ├── bump.ts               (version bump operations)
    ├── order.ts              (SemVerOrder, SemVerOrderWithBuild)
    └── prettyPrint.ts        (Match.exhaustive pretty printer)
__test__/                     (adjacent to src/, not inside it)
├── fixtures/
│   ├── versions.ts
│   ├── ranges.ts
│   └── increments.ts
├── SemVer.test.ts
├── schemas.test.ts
├── parseVersion.test.ts
├── parseRange.test.ts
├── SemVerParser.test.ts
├── VersionCache.test.ts
├── errors.test.ts
├── order.test.ts
├── compare.test.ts
├── matching.test.ts
├── algebra.test.ts
├── diff.test.ts
├── bump.test.ts
├── prettyPrint.test.ts
├── coverage.test.ts
└── spec-compliance.test.ts
```

**Conventions:**

- **No barrel files** except `src/index.ts` -- all imports go directly to
  source files
- **One concern per file** -- each schema, error, service gets its own file
- **`schemas/`** -- Schema.TaggedClass types (data model)
- **`errors/`** -- TaggedError subclasses (one per file, split base pattern)
- **`services/`** -- Service interfaces + GenericTag (no implementation)
- **`layers/`** -- Layer implementations (the "Live" variants)
- **`utils/`** -- Pure helper functions and internal logic
- **Tests** live in `__test__/` (top-level, adjacent to `src/`); fixtures in
  `__test__/fixtures/`

### Error Handling Strategy

All errors extend TaggedError and flow through Effect's typed error channel:

- Parser errors include input string and optional position
- Resolution errors include the range/version that failed
- Constraint errors include the conflicting constraints
- All errors derive their `message` via a getter from structured fields
- Users handle errors via Effect.catchTag or Effect.match

---

## Data Flow

### Parsing Flow

```text
String input
     |
     v
parseVersion() / parseRange() / parseComparator()
     |  (convenience functions delegating to grammar.ts)
     v
grammar.ts (recursive descent, char by char)
     |
     +---> desugar.ts (for range sugar: tilde, caret, x-range, hyphen)
     |
     +---> normalize.ts (sort comparators, remove duplicates)
     |
     +---> Success: SemVer / Range / Comparator
     |
     +---> Failure: InvalidVersionError / InvalidRangeError / InvalidComparatorError
                    (with position info)
```

### Range Resolution Flow

```text
Range + VersionCache
     |
     v
VersionCache.resolve(range) or VersionCache.resolveString(input)
     |
     v
Read Ref<SortedSet<SemVer>>
     |
     v
Iterate from highest version, test satisfies(v, range)
     |
     +---> Found: highest matching SemVer
     |
     +---> Not found: UnsatisfiedRangeError
```

### Range Desugaring

```text
"^1.2.3"  -->  >=1.2.3 <2.0.0-0
"~1.2.3"  -->  >=1.2.3 <1.3.0-0
"1.2.x"   -->  >=1.2.0 <1.3.0-0
"1.2.3 - 2.0.0"  -->  >=1.2.3 <=2.0.0
```

All syntactic sugar is desugared to primitive Comparator/ComparatorSet
during parsing, before any matching occurs.

---

## Integration Points

### Effect Ecosystem Integration

- **Effect.Schema:** Data types use Schema.TaggedClass for serialization
- **Effect.Order:** SemVer exposes Order instance for Array.sort, SortedSet
- **Effect.Equal/Hash:** SemVer implements custom Equal (ignoring build metadata
  per spec) and Hash (excluding build from hash computation)
- **Inspectable:** SemVer implements toString, toJSON, and nodejs.util.inspect.custom
- **Effect.Match:** prettyPrint uses Match.exhaustive for type-safe printing
- **Function.dual:** All binary pure operations support data-first and data-last

### Build System

- ESM-only, ES2022 target
- `effect` as peer dependency (^3.19.19)
- Built with Rslib via the monorepo build pipeline
- Dual output: `dist/dev/` (development) and `dist/npm/` (production)

---

## Testing Strategy

### Test Suite

**Location:** `__test__/` (top-level, adjacent to `src/`)

**Framework:** Vitest with v8 coverage, forks pool for Effect-TS compatibility.

**Scale:** 476 tests across 19 test files (~3920 lines of test code).

**Test files:**

- `SemVer.test.ts` -- construction, equality, ordering, bumping, traits
- `schemas.test.ts` -- schema validation, serialization
- `parseVersion.test.ts` -- version parsing edge cases
- `parseRange.test.ts` -- range parsing, desugaring
- `SemVerParser.test.ts` -- service layer parsing via Layer
- `VersionCache.test.ts` -- service operations, resolution, concurrency
- `errors.test.ts` -- error construction, fields, messages, pattern matching
- `order.test.ts` -- SemVerOrder, SemVerOrderWithBuild
- `compare.test.ts` -- comparison helpers, dual API
- `matching.test.ts` -- satisfies, filter, maxSatisfying, minSatisfying
- `algebra.test.ts` -- intersect, union, simplify, isSubset, equivalent
- `diff.test.ts` -- VersionDiff classification and deltas
- `bump.test.ts` -- bump operations
- `prettyPrint.test.ts` -- Match.exhaustive pretty printing
- `coverage.test.ts` -- comprehensive edge case coverage
- `spec-compliance.test.ts` -- SemVer 2.0.0 specification compliance

**Fixtures:** `__test__/fixtures/` contains ported node-semver strict-mode test
vectors for versions, ranges, and increments.

---

## Future Enhancements

### Potential Additions

- Sync/non-Effect wrapper API (if demand exists)
- Additional range algebra optimizations
- Performance benchmarking against node-semver
- Additional VersionFetcher implementations (npm, GitHub)

---

## Related Documentation

**Design Documents:**

- [Data Model](data-model.md) -- Core types: SemVer, Comparator, Range, VersionDiff
- [Parser](parser.md) -- Recursive descent parser, BNF grammar, desugaring
- [Error Model](error-model.md) -- TaggedError hierarchy with field specs
- [Operations](operations.md) -- Comparison, range matching, range algebra, diffing
- [Version Cache](version-cache.md) -- VersionCache service API and internals
- [Testing](testing.md) -- Test strategy, coverage targets, Effect testing patterns

**Package Documentation:**

- `README.md` -- Package overview
- `CLAUDE.md` -- Development guide

---

**Document Status:** Current -- reflects the complete implemented architecture.
All components are implemented, tested, and working with 476 tests across 19
test files.
