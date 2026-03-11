---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-11
last-synced: 2026-03-11
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
immutable Data.TaggedClass instances.

**Key Design Principles:**

- Strict SemVer 2.0.0 grammar only -- no loose mode, no coercion, no v-prefix tolerance
- Effect-native API: all parsing operations return Effect with typed error channels
- Rich error model via TaggedError with positional parse info
- Immutable data types via Data.TaggedClass with Equal, Order, Hash, Inspectable
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
and working. The package has 650 tests across 16 test files with high branch
coverage. The public API uses an Effect-idiomatic namespaced module pattern.

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

- parseVersion (exposed as `SemVer.fromString`): string to SemVer with precise error positions
- parseRange (exposed as `Range.fromString`): string to Range with desugaring and normalization
- parseComparator (exposed as `Comparator.fromString`): string to Comparator
- Hand-written recursive descent PEG parser, character-by-character walk
- All syntactic sugar desugared during parsing

#### Component 3: Operations (utils/)

**Location:** `src/utils/compare.ts`, `src/utils/matching.ts`,
`src/utils/algebra.ts`, `src/utils/diff.ts`, `src/utils/bump.ts`,
`src/utils/order.ts`, `src/utils/prettyPrint.ts`

**Status:** Implemented and tested.

**Responsibilities:**

- Comparison: `SemVer.compare`, `SemVer.equal`, `SemVer.gt`, `SemVer.gte`,
  `SemVer.lt`, `SemVer.lte`, `SemVer.neq`, `SemVer.sort`, `SemVer.rsort`,
  `SemVer.max`, `SemVer.min`
- Matching: `Range.satisfies`, `Range.filter`, `Range.maxSatisfying`,
  `Range.minSatisfying`
- Algebra: `Range.intersect`, `Range.union`, `Range.simplify`,
  `Range.isSubset`, `Range.equivalent`
- Diffing: `SemVer.diff` (produces VersionDiff)
- Bumping: `SemVer.bump.major`, `SemVer.bump.minor`, `SemVer.bump.patch`,
  `SemVer.bump.prerelease`, `SemVer.bump.release`
- Ordering: `SemVer.Order`, `SemVer.OrderWithBuild`, `SemVer.Equivalence`
- Pretty-printing: `PrettyPrint.prettyPrint` via Match.exhaustive

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
    +-----------+-------------+-------------+-----------+
    |           |             |             |           |
  Namespace   Namespace    Namespace    Flat exports  Flat exports
  modules     modules     modules     (errors)     (services/layers)
    |           |             |
  SemVer.ts  Range.ts    Comparator.ts  PrettyPrint.ts  VersionDiff.ts
    |           |             |
    |  (aggregation modules -- collect from schemas/ and utils/)
    |           |             |
    +-----+-----+-----+------+
          |           |
      schemas/     utils/              services/       layers/
      SemVer.ts    grammar.ts          SemVerParser.ts SemVerParserLive.ts
      Range.ts     desugar.ts          VersionCache.ts VersionCacheLive.ts
      Comparator   normalize.ts        VersionFetcher
      VersionDiff  compare.ts
                   matching.ts      errors/
                   algebra.ts       InvalidVersionError.ts
                   diff.ts          InvalidRangeError.ts
                   bump.ts          InvalidComparatorError.ts
                   order.ts         (... 7 more)
                   parseRange.ts
                   prettyPrint.ts

  Data.TaggedClass (split base pattern)
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

#### Decision 3: Data.TaggedClass for Data Types

**Context:** Need immutable, tagged version data types with structural equality.

**Options considered:**

1. **Schema.TaggedClass (Originally chosen, later replaced):**
   - Pros: Built-in Schema serialization, pattern matching via _tag
   - Cons: Forward self-reference `<SemVer>` in `Schema.TaggedClass<SemVer>()`
     generates un-nameable `_base` types that break declaration bundling
     (api-extractor). Cannot extract the base to a named export with tsgo.
   - Why replaced: Schema encode/decode was never used by consumers;
     the un-nameable types caused "forgotten export" errors in ci:build.

2. **Data.TaggedClass (Chosen):**
   - Pros: Pattern matching via _tag, structural equality, no forward
     reference needed, extracted base follows same pattern as Data.TaggedError
     and Context.GenericTag
   - Cons: No built-in Schema encode/decode (not needed)
   - Why chosen: Solves the declaration bundling problem while preserving
     all needed traits. The `*Base` export gives api-extractor a stable
     reference. ci:build passes cleanly with zero forgotten exports.

3. **Plain interfaces + custom Equal:**
   - Pros: Lighter weight
   - Cons: Manual Equal/Hash, no _tag discrimination
   - Why rejected: Data.TaggedClass provides needed traits with minimal overhead

**Implementation note:** Custom Equal and Hash overrides are mandatory on
SemVer because the default Data.TaggedClass equality does shallow reference
comparison on arrays, and build metadata must be excluded from both
equality and hashing per the SemVer spec.

### Design Patterns Used

#### Pattern 1: Interface + GenericTag Service Pattern

- **Where used:** SemVerParser, VersionCache, VersionFetcher
- **Why used:** Dependency injection, testability, multiple instances
- **Implementation:** Interface + `Context.GenericTag` in `services/`, Layer in
  `layers/`. GenericTag avoids un-nameable `_base` types that break
  api-extractor declaration bundling when re-exported via `export *`.

#### Pattern 2: Split Base for TaggedError and TaggedClass

- **Where used:** All 10 error types in `errors/` (one file per error),
  all 4 schema classes in `schemas/` (SemVer, Comparator, Range, VersionDiff)
- **Why used:** Typed error channels, pattern matching, rich context,
  declaration bundling compatibility
- **Implementation:** Each file exports a named `*Base` constant
  (`Data.TaggedError(...)` for errors, `Data.TaggedClass(...)` for schemas)
  and a class extending it. The split base gives api-extractor a stable
  reference instead of an un-nameable inline call. The `*Base` export is
  marked `@internal`.

#### Pattern 3: Namespaced Module Aggregation

- **Where used:** `src/SemVer.ts`, `src/Range.ts`, `src/Comparator.ts`,
  `src/PrettyPrint.ts`, `src/VersionDiff.ts`
- **Why used:** Matches Effect's own API pattern (DateTime, Duration, etc.)
  where all operations for a type are accessed through a single namespace
- **Implementation:** Each aggregation module re-exports the class/base from
  `schemas/`, re-exports operations from `utils/`, and adds convenience
  constructors (`make`), constants (`ZERO`, `any`), Schema transforms
  (`Instance`, `FromString`), and Effect instances (`Order`, `Equivalence`).
  The barrel (`src/index.ts`) uses `export * as SemVer from "./SemVer.js"`.
  No standalone function exports exist in the barrel.

#### Pattern 4: No Barrel Files in Subdirectories

- **Where used:** Entire codebase
- **Why used:** Avoids circular imports, improves tree-shaking
- **Implementation:** Only `src/index.ts` is a barrel. The top-level
  aggregation modules are not barrels for their subdirectories; they are
  curated namespace surfaces. No `schemas/index.ts`, no `errors/index.ts`.

#### Pattern 5: Dual API (data-first + data-last)

- **Where used:** All binary pure operations (compare, satisfies, filter, etc.)
- **Why used:** Effect ecosystem convention, pipe ergonomics
- **Implementation:** Uses `Function.dual(2, ...)` for all binary operations.
  Enables both `SemVer.gt(a, b)` and `pipe(a, SemVer.gt(b))`.

#### Pattern 6: Direct Construction (No Runtime Validation)

- **Where used:** Parser output, bump operations, desugar, normalize
- **Why it works:** Data.TaggedClass constructors take a single object
  argument with no runtime schema validation. Field types are plain
  TypeScript (`number`, `ReadonlyArray<string | number>`, etc.). The parser
  validates input before construction; bump operations produce values that
  are correct by construction. This replaced the previous
  `{ disableValidation: true }` second argument that was specific to
  Schema.TaggedClass.

---

## System Architecture

### Source Layout

```text
src/
├── index.ts                  (only barrel -- namespace re-exports + flat error/service exports)
├── SemVer.ts                 (namespace aggregation module)
├── Range.ts                  (namespace aggregation module)
├── Comparator.ts             (namespace aggregation module)
├── PrettyPrint.ts            (namespace aggregation module)
├── VersionDiff.ts            (namespace aggregation module)
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

- **Namespaced module pattern** -- top-level aggregation modules (`SemVer.ts`,
  `Range.ts`, `Comparator.ts`, `PrettyPrint.ts`, `VersionDiff.ts`) collect
  operations from `schemas/` and `utils/` into namespace modules, matching
  Effect's own pattern (e.g., `DateTime`, `Duration`). Users access
  functionality through these namespaces: `SemVer.gt()`, `Range.satisfies()`,
  `SemVer.bump.major()`.
- **Barrel uses `export * as`** -- `src/index.ts` re-exports namespace modules
  via `export * as SemVer from "./SemVer.js"` and uses flat named exports only
  for errors, services, and layers. No standalone function exports.
- **One concern per file** -- each schema, error, service gets its own file
- **`schemas/`** -- Data.TaggedClass types (data model, split base pattern)
- **`errors/`** -- TaggedError subclasses (one per file, split base pattern)
- **`services/`** -- Service interfaces + GenericTag (no implementation)
- **`layers/`** -- Layer implementations (the "Live" variants)
- **`utils/`** -- Pure helper functions and internal logic (internal; not
  directly exported from index.ts)
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
SemVer.fromString() / Range.fromString() / Comparator.fromString()
     |  (namespace methods delegating to grammar.ts / parseRange.ts)
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

- **Effect.Data:** Data types use Data.TaggedClass for tagged immutability
- **Effect.Order:** `SemVer.Order` and `SemVer.OrderWithBuild` for Array.sort,
  SortedSet
- **Effect.Equivalence:** `SemVer.Equivalence` for spec-compliant equality
- **Effect.Equal/Hash:** SemVer implements custom Equal (ignoring build metadata
  per spec) and Hash (excluding build from hash computation)
- **Effect.Schema:** Each namespace module provides `Instance`
  (`Schema.instanceOf`) and `FromString` (`Schema.transformOrFail`) schemas
  for integration with Schema.Config, Schema.decodeUnknownSync, etc.
- **Inspectable:** SemVer implements toString, toJSON, and nodejs.util.inspect.custom
- **Effect.Match:** PrettyPrint.prettyPrint uses Match.exhaustive for type-safe
  printing
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

**Scale:** 650 tests across 16 test files (~3920 lines of test code).

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

**Document Status:** Current -- reflects the complete implemented architecture
with Effect-idiomatic namespaced module pattern. All components are
implemented, tested, and working with 650 tests across 16 test files.
