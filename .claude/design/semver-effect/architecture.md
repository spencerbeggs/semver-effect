---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-17
last-synced: 2026-03-17
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
- Class-based API as primary interface: instance methods (e.g., `v.compare()`, `v.bump.*`,
  `range.test()`) and static methods (e.g., `SemVer.parse()`, `Range.parse()`) on schema classes
- Standalone functions for pipe/data-last composition as alternative interface
- Rich error model via TaggedError with positional parse info
- Immutable data types via Schema.TaggedClass with Equal, Order, Hash, Inspectable
- Service-based architecture: SemVerParser and VersionCache as Effect services (class-based Context.Tag)

**When to reference this document:**

- When understanding the overall module structure and dependency graph
- When reasoning about the service pattern (class-based Context.Tag + Layer)
- When deciding where new functionality should live
- When understanding the build pipeline and export surface

---

## Current State

### Implementation Status

The implementation is **complete**. All core modules are implemented, tested,
and working. The package has 650 tests across 16 test files with high branch
coverage. The public API uses flat exports from `src/index.ts` -- all classes,
functions, errors, services, and layers are exported directly by name.

#### Component 1: Core Data Types (schemas/)

**Location:** `src/schemas/SemVer.ts`, `src/schemas/Range.ts`,
`src/schemas/Comparator.ts`, `src/schemas/VersionDiff.ts`

**Status:** Implemented and tested.

**Responsibilities:**

- SemVer: major/minor/patch/prerelease/build with custom Equal, Order, Hash,
  Inspectable (toString, toJSON, nodejs.util.inspect.custom). Instance methods
  for comparison (`compare`, `gt`, `gte`, `lt`, `lte`, `eq`, `neq`), predicates
  (`isPrerelease`, `isStable`), and bumping (`bump.major()`, `bump.minor()`,
  `bump.patch()`, `bump.prerelease()`, `bump.release()`). Static methods for
  parsing (`SemVer.parse`), comparison (`SemVer.compare`, `SemVer.gt`, etc.),
  collections (`SemVer.sort`, `SemVer.rsort`, `SemVer.max`, `SemVer.min`),
  and diffing (`SemVer.diff`).
- Comparator: operator + version pairing with toString. Instance method `test(version)`.
  Static method `Comparator.parse`.
- ComparatorSet: type alias for `ReadonlyArray<Comparator>` (not a class)
- Range: OR of ComparatorSets with toString. Instance methods `test(version)` and
  `filter(versions)`. Static methods `Range.parse`, `Range.satisfies`,
  `Range.filter`, `Range.maxSatisfying`, `Range.minSatisfying`.
- VersionDiff: structured diff between two versions with type classification

#### Component 2: Parser (services/ + layers/ + utils/)

**Location:** `src/services/SemVerParser.ts` (class-based Context.Tag),
`src/layers/SemVerParserLive.ts` (implementation),
`src/utils/grammar.ts` (recursive descent parser),
`src/utils/desugar.ts` (range desugaring),
`src/utils/normalize.ts` (range normalization),
`src/utils/parseRange.ts` (convenience wrapper)

**Status:** Implemented and tested.

**Responsibilities:**

- parseValidSemVer: string to SemVer with precise error positions
- parseRange: string to Range with desugaring and normalization
- parseSingleComparator: string to Comparator
- Hand-written recursive descent PEG parser, character-by-character walk
- All syntactic sugar desugared during parsing

#### Component 3: Operations (utils/)

**Location:** `src/utils/compare.ts`, `src/utils/matching.ts`,
`src/utils/algebra.ts`, `src/utils/diff.ts`, `src/utils/bump.ts`,
`src/utils/order.ts`, `src/utils/prettyPrint.ts`

**Status:** Implemented and tested.

**Responsibilities:**

- Comparison: `compare`, `equal`, `gt`, `gte`, `lt`, `lte`, `neq`, `sort`,
  `rsort`, `max`, `min`
- Matching: `satisfies`, `filter`, `maxSatisfying`, `minSatisfying`
- Algebra: `intersect`, `union`, `simplify`, `isSubset`, `equivalent`
- Diffing: `diff` (produces VersionDiff)
- Bumping: `bumpMajor`, `bumpMinor`, `bumpPatch`, `bumpPrerelease`,
  `bumpRelease`
- Ordering: `SemVerOrder`, `SemVerOrderWithBuild`
- Pretty-printing: `prettyPrint` via Match.exhaustive

#### Component 4: VersionCache (services/ + layers/)

**Location:** `src/services/VersionCache.ts` (class-based Context.Tag),
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

**Location:** `src/services/VersionFetcher.ts` (class-based Context.Tag only)

**Status:** Interface defined. No concrete implementation provided (by design).

**Responsibilities:**

- Abstract interface for fetching versions from external sources
- Consumers provide their own Layer implementations

### Architecture Diagram

```text
               Public API (src/index.ts -- only barrel)
                              |
    +------------+------------+------------+------------+
    |            |            |            |            |
  schemas/    utils/       services/    layers/      errors/
  SemVer.ts   grammar.ts   SemVerParser SemVerParser InvalidVersionError.ts
  Range.ts    desugar.ts   VersionCache VersionCache InvalidRangeError.ts
  Comparator  normalize.ts VersionFetcher  Live.ts   InvalidComparatorError.ts
  VersionDiff compare.ts                             (... 7 more)
              matching.ts
              algebra.ts
              diff.ts
              bump.ts
              order.ts
              parseRange.ts
              prettyPrint.ts

  All exports are flat from index.ts -- no namespace modules.
  Schema.TaggedClass for data types (single class, no Base).
  Data.TaggedError with split base for errors.
  Class-based Context.Tag for services.
  Equal + Order + Hash + Inspectable on SemVer.
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

**Context:** Need immutable, tagged version data types with structural equality.

**Options considered:**

1. **Schema.TaggedClass (Chosen):**
   - Pros: Built-in Schema serialization, pattern matching via _tag,
     structural equality, immutability. Single class declaration with
     no split base needed. Fields are Schema types (`Schema.Number`,
     `Schema.Array(Schema.String)`, etc.).
   - Cons: Slightly heavier than Data.TaggedClass
   - Why chosen: Provides all needed traits. The single class pattern
     (`class Foo extends Schema.TaggedClass<Foo>()("Foo", { ... })`)
     is clean and requires no `@internal` Base export for schemas.

2. **Data.TaggedClass (Previously used):**
   - Pros: Lighter weight, pattern matching via _tag
   - Cons: Required split base pattern with `@internal` `*Base` exports
     for api-extractor compatibility. No built-in Schema encode/decode.
   - Why replaced: Schema.TaggedClass eliminates the need for Base exports
     on data types while providing built-in Schema support.

3. **Plain interfaces + custom Equal:**
   - Pros: Lighter weight
   - Cons: Manual Equal/Hash, no _tag discrimination
   - Why rejected: Schema.TaggedClass provides needed traits with minimal overhead

**Implementation note:** Custom Equal and Hash overrides are mandatory on
SemVer because the default equality does shallow reference comparison on
arrays, and build metadata must be excluded from both equality and hashing
per the SemVer spec.

### Design Patterns Used

#### Pattern 1: Class-Based Context.Tag Service Pattern

- **Where used:** SemVerParser, VersionCache, VersionFetcher
- **Why used:** Dependency injection, testability, multiple instances
- **Implementation:** Each service is a class extending `Context.Tag` with a
  fully-qualified identifier (e.g., `"semver-effect/SemVerParser"`). The class
  declaration merges the tag and interface in a single expression:
  `class Foo extends Context.Tag("semver-effect/Foo")<Foo, { ... }>() {}`

#### Pattern 2: Split Base for TaggedError Only

- **Where used:** All 10 error types in `errors/` (one file per error)
- **Why used:** Typed error channels, pattern matching, rich context,
  declaration bundling compatibility
- **Implementation:** Each error file exports a named `*Base` constant
  (`Data.TaggedError(...)`) and a class extending it. The split base gives
  api-extractor a stable reference instead of an un-nameable inline call.
  The `*Base` export is marked `@internal`.
- **Note:** Schema classes in `schemas/` do NOT use the split base pattern.
  They use `Schema.TaggedClass` as a single class declaration with no
  separate Base export.

#### Pattern 3: Flat Export Surface

- **Where used:** `src/index.ts`
- **Why used:** Simpler API, no namespace indirection, direct named imports
- **Implementation:** All public API is exported directly from `src/index.ts`
  as flat named exports: classes from `schemas/`, functions from `utils/`,
  errors from `errors/`, services from `services/`, layers from `layers/`.
  No `export * as` pattern. No namespace aggregation modules. Users import
  directly: `import { SemVer, gt, parseValidSemVer } from "semver-effect"`.

#### Pattern 4: No Barrel Files in Subdirectories

- **Where used:** Entire codebase
- **Why used:** Avoids circular imports, improves tree-shaking
- **Implementation:** Only `src/index.ts` is a barrel. No `schemas/index.ts`,
  no `errors/index.ts`. All internal imports go directly to source files.

#### Pattern 5: Class-Based API (Instance + Static Methods)

- **Where used:** SemVer, Comparator, Range schema classes
- **Why used:** Ergonomic primary API, discoverable via autocompletion
- **Implementation:** Schema classes have instance methods (e.g., `v.compare()`,
  `v.bump.major()`, `range.test()`) and static methods (e.g., `SemVer.parse()`,
  `SemVer.sort()`). Static method declarations live on the class; wiring to
  standalone function implementations happens in `index.ts` at module load.
  Instance methods are defined directly on the class body.

#### Pattern 5b: Dual API (data-first + data-last) for Standalone Functions

- **Where used:** All binary standalone functions (compare, satisfies, filter, etc.)
- **Why used:** Effect ecosystem convention, pipe ergonomics, alternative to class API
- **Implementation:** Uses `Function.dual(2, ...)` for all binary operations.
  Enables both `gt(a, b)` and `pipe(a, gt(b))`.

#### Pattern 6: Direct Construction (No Runtime Validation)

- **Where used:** Parser output, bump operations, desugar, normalize
- **Why it works:** Schema.TaggedClass instances are constructed with
  `new Foo({ ... }, { disableValidation: true })` internally by the parser
  and bump operations, bypassing runtime schema validation for trusted
  inputs. The parser validates input before construction; bump operations
  produce values that are correct by construction.

---

## System Architecture

### Source Layout

```text
src/
├── index.ts                  (only barrel -- flat named exports from all subdirectories)
├── schemas/
│   ├── SemVer.ts             (Schema.TaggedClass, single class, no Base export)
│   ├── Comparator.ts         (Schema.TaggedClass, single class, no Base export)
│   ├── Range.ts              (Schema.TaggedClass + ComparatorSet type alias)
│   └── VersionDiff.ts        (Schema.TaggedClass, single class, no Base export)
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
│   ├── SemVerParser.ts       (class-based Context.Tag)
│   ├── VersionCache.ts       (class-based Context.Tag)
│   └── VersionFetcher.ts     (class-based Context.Tag)
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

- **Flat export surface** -- `src/index.ts` exports all public API as flat
  named exports. No `export * as` pattern. Users import directly:
  `import { SemVer, gt, parseValidSemVer, SemVerParser } from "semver-effect"`.
- **One concern per file** -- each schema, error, service gets its own file
- **`schemas/`** -- Schema.TaggedClass types (single class declaration, no
  Base export)
- **`errors/`** -- TaggedError subclasses (one per file, split base pattern
  with `@internal` `*Base` export)
- **`services/`** -- Class-based Context.Tag services (no implementation)
- **`layers/`** -- Layer implementations (the "Live" variants)
- **`utils/`** -- Pure helper functions and internal logic (exported directly
  from index.ts)
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
parseValidSemVer() / parseRange() / parseSingleComparator()
     |  (exported directly from utils/, re-exported from index.ts)
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

- **Effect.Schema:** Data types use Schema.TaggedClass for tagged immutability
  with built-in Schema encode/decode support
- **Effect.Order:** `SemVerOrder` and `SemVerOrderWithBuild` for Array.sort,
  SortedSet
- **Effect.Equal/Hash:** SemVer implements custom Equal (ignoring build metadata
  per spec) and Hash (excluding build from hash computation)
- **Inspectable:** SemVer implements toString, toJSON, and nodejs.util.inspect.custom
- **Effect.Match:** `prettyPrint` uses Match.exhaustive for type-safe printing
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
with flat export surface from index.ts, Schema.TaggedClass for data types
with instance and static methods as the primary API, standalone functions for
pipe composition, class-based Context.Tag for services, and Data.TaggedError
with split base for errors. All components are implemented, tested, and
working with 650 tests across 16 test files.
