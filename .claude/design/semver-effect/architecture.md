---
status: draft
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: never
completeness: 35
related:
  - data-model.md
  - parser.md
  - error-model.md
  - operations.md
  - version-cache.md
  - testing.md
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

- Strict SemVer 2.0.0 grammar only -- no loose mode, no coercion, no v1 compat
- Effect-native API: all operations return Effect with typed error channels
- Rich error model via TaggedError with positional parse info
- Immutable data types via Schema.TaggedClass with Equal, Order, Hash, Inspectable
- Service-based architecture: SemVerParser and VersionCache as Effect services

**When to reference this document:**

- When implementing core data types (SemVer, Range, Comparator)
- When building the recursive descent parser
- When designing the VersionCache service
- When adding new range algebra operations

---

## Current State

### System Components

The project is in early implementation. The design spec is approved and the
package structure is scaffolded, but core modules have not yet been implemented.

#### Component 1: Core Data Types (schemas/)

**Location:** `src/schemas/SemVer.ts`, `src/schemas/Range.ts`,
`src/schemas/Comparator.ts`, `src/schemas/VersionDiff.ts`

**Purpose:** Immutable, Effect-native representations of SemVer concepts.

**Responsibilities:**

- SemVer: major/minor/patch/prerelease/build with Equal, Order, Hash
- Comparator: operator + version pairing
- ComparatorSet: implicit AND of Comparators
- Range: implicit OR of ComparatorSets with desugaring
- VersionDiff: structured diff between two versions

#### Component 2: Parser (services/ + layers/)

**Location:** `src/services/SemVerParser.ts` (interface + tag),
`src/layers/SemVerParserLive.ts` (implementation),
`src/utils/grammar.ts`, `src/utils/desugar.ts`, `src/utils/normalize.ts`

**Purpose:** Recursive descent parser for SemVer 2.0.0 BNF grammar.

**Responsibilities:**

- parseVersion: string to SemVer with precise error positions
- parseRange: string to Range with desugaring of syntactic sugar
- parseComparator: string to Comparator
- No regex -- character-by-character walk of the grammar

#### Component 3: VersionCache (services/ + layers/)

**Location:** `src/services/VersionCache.ts` (interface + tag),
`src/layers/VersionCacheLive.ts` (implementation)

**Purpose:** Queryable cache of known versions backed by `Ref<SortedSet<SemVer>>`.

**Responsibilities:**

- Load, add, remove versions
- Resolve ranges against cached versions
- Group, filter, diff, navigate version sets
- Multiple caches coexist via Effect service model

#### Component 4: Error Model (errors/)

**Location:** `src/errors/` (one file per error class)

**Purpose:** Rich typed errors extending TaggedError.

**Responsibilities:**

- Parsing errors: InvalidVersionError, InvalidRangeError,
  InvalidComparatorError, InvalidPrereleaseError
- Resolution errors: UnsatisfiedRangeError, VersionNotFoundError,
  EmptyCacheError
- Constraint errors: UnsatisfiableConstraintError, InvalidBumpError

### Architecture Diagram

```text
                     Public API (src/index.ts -- only barrel)
                              |
       +-------------+-------+-------+-------------+
       |              |               |             |
   schemas/       services/       layers/       errors/
   SemVer.ts      SemVerParser.ts SemVerParser  InvalidVersionError.ts
   Range.ts       VersionCache.ts  Live.ts      InvalidRangeError.ts
   Comparator.ts  (interface +    VersionCache  ...etc (one per error)
   VersionDiff.ts  GenericTag)      Live.ts
       |                              |
       |                          utils/
       |                          grammar.ts
       |                          desugar.ts
       |                          normalize.ts
       |
  Schema.TaggedClass
  Equal + Order + Hash
```

### Current Limitations

- Project is in scaffolding stage; core modules are not yet implemented
- Source currently contains placeholder code from the template

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
   - Pros: Built-in Equal/Hash, serialization, pattern matching via _tag
   - Cons: Effect dependency for data types
   - Why chosen: Integrates naturally with Effect ecosystem

2. **Plain interfaces + custom Equal:**
   - Pros: Lighter weight
   - Cons: Manual Equal/Hash/serialization
   - Why rejected: Schema.TaggedClass provides all needed traits for free

### Design Patterns Used

#### Pattern 1: Interface + GenericTag Service Pattern

- **Where used:** SemVerParser, VersionCache
- **Why used:** Dependency injection, testability, multiple instances
- **Implementation:** Interface + `Context.GenericTag` in `services/`, Layer in
  `layers/`. GenericTag avoids un-nameable `_base` types that break
  api-extractor declaration bundling when re-exported via `export *`.

#### Pattern 2: Split Base for TaggedError

- **Where used:** All error types in `errors/` (one file per error)
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

---

## System Architecture

### Source Layout

```text
src/
├── index.ts                  (only barrel export)
├── schemas/
│   ├── SemVer.ts
│   ├── Comparator.ts
│   ├── Range.ts
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
│   └── InvalidBumpError.ts
├── services/
│   ├── SemVerParser.ts       (interface + GenericTag)
│   └── VersionCache.ts       (interface + GenericTag)
├── layers/
│   ├── SemVerParserLive.ts
│   └── VersionCacheLive.ts
├── utils/
│   ├── grammar.ts            (BNF grammar rules)
│   ├── desugar.ts            (range sugar -> primitive comparators)
│   ├── normalize.ts          (range normalization)
│   ├── compare.ts            (pure comparison functions)
│   └── matching.ts           (range matching logic)
__test__/                            (adjacent to src/, not inside it)
├── SemVer.test.ts
├── Range.test.ts
├── Parser.test.ts
├── VersionCache.test.ts
├── order.test.ts
├── errors.test.ts
└── utils/                           (shared test helpers)
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
- **Tests** live in `__test__/` (top-level, adjacent to `src/`); helpers in
  `__test__/utils/`

### Error Handling Strategy

All errors extend TaggedError and flow through Effect's typed error channel:

- Parser errors include input string and optional position
- Resolution errors include the range/version that failed
- Constraint errors include the conflicting constraints
- Users handle errors via Effect.catchTag or Effect.match

---

## Data Flow

### Parsing Flow

```text
String input
     |
     v
SemVerParser.parseVersion() / parseRange()
     |
     v
internal/grammar.ts (recursive descent, char by char)
     |
     +---> Success: SemVer / Range
     |
     +---> Failure: InvalidVersionError / InvalidRangeError
                    (with position info)
```

### Range Resolution Flow

```text
Range + VersionCache
     |
     v
VersionCache.resolve(range)
     |
     v
Read Ref<SortedSet<SemVer>>
     |
     v
Filter versions matching range
     |
     +---> Found: highest matching SemVer
     |
     +---> Not found: UnsatisfiedRangeError
```

### Range Desugaring

```text
"^1.2.3"  -->  >=1.2.3 <2.0.0
"~1.2.3"  -->  >=1.2.3 <1.3.0
"1.2.x"   -->  >=1.2.0 <1.3.0
"1.2.3 - 2.0.0"  -->  >=1.2.3 <=2.0.0
```

All syntactic sugar is desugared to primitive Comparator/ComparatorSet
during parsing, before any matching occurs.

---

## Integration Points

### Effect Ecosystem Integration

- **Effect.Schema:** Data types use Schema.TaggedClass for serialization
- **Effect.Order:** SemVer exposes Order instance for Array.sort, SortedSet
- **Effect.Equal/Hash:** SemVer implements Equal (ignoring build metadata per
  spec) and derived Hash
- **Effect.Inspectable:** SemVer formats as spec-compliant string

### Build System

- ESM-only, ES2022 target
- `effect` as peer dependency
- Built with Rslib via the monorepo build pipeline

---

## Testing Strategy

### Unit Tests

**Location:** `__test__/` (top-level, adjacent to `src/`)

**Test files planned:**

- `SemVer.test.ts` -- construction, equality, ordering, bumping
- `Range.test.ts` -- parsing, matching, algebra
- `Parser.test.ts` -- grammar edge cases, error positions
- `VersionCache.test.ts` -- service operations, resolution
- `order.test.ts` -- Order instance, sorting
- `errors.test.ts` -- error construction, fields, messages

**Coverage target:** High coverage with emphasis on parser edge cases and
spec compliance.

**What to test:**

- Full SemVer 2.0.0 spec compliance
- All range syntactic sugar desugaring
- Error position accuracy
- VersionCache concurrency behavior

---

## Future Enhancements

### Phase 1: Core Implementation

- Implement all data types (SemVer, Range, Comparator, VersionDiff)
- Build recursive descent parser
- Implement VersionCache service
- Complete error model

### Phase 2: Range Algebra

- Range.intersect, Range.union, Range.simplify
- Range.isSubset, Range.equivalent
- Constraint solving across multiple ranges

### Phase 3: Superset Features

- Structured diffs (VersionDiff with deltas)
- VersionCache grouping and navigation (groupBy, latestByMajor, next, prev)
- Sync/non-Effect wrapper API (if demand exists)

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

**Document Status:** Draft -- covers architectural decisions and component
structure based on the approved design spec. Will be updated as implementation
progresses.

**Next Steps:** Update Current State section as core modules are implemented.
Add performance design doc when parser optimization begins.
