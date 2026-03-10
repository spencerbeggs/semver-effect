# semver-effect Design Spec

**Date:** 2026-03-10
**Status:** Approved
**Repo:** <https://github.com/spencerbeggs/semver-effect>

## Overview

A strict SemVer 2.0.0 implementation built on Effect, replacing node-semver
for Effect-native TypeScript applications. No loose mode, no v1 backward
compatibility, no coercion. Invalid input is a typed error, not `null`.

## Goals

- Strict SemVer 2.0.0 grammar only
- Effect-native API (all functions return `Effect`)
- Rich typed errors via `TaggedError` with positional parse info
- Immutable data types via `Schema.TaggedClass`
- `VersionCache` service for querying known version sets
- Superset features: constraint solving, range algebra, structured diffs

## Non-Goals

- CJS support
- Loose/coercion modes
- v1 semver backward compatibility
- Sync/non-Effect wrapper API (may come later)

## Core Data Model

### SemVer (Schema.TaggedClass)

```text
SemVer
├── major: number       (non-negative integer)
├── minor: number       (non-negative integer)
├── patch: number       (non-negative integer)
├── prerelease: ReadonlyArray<string | number>
└── build: ReadonlyArray<string>
```

- `Equal`: structural, ignoring build metadata per spec
- `Order`: major > minor > patch > prerelease per spec rules
- `Hash`: derived from Equal
- `Inspectable`: formatted as spec-compliant string

Static methods:

- `SemVer.bump.major(v)` / `.minor(v)` / `.patch(v)` / `.prerelease(v, id?)`
  / `.release(v)`

### Comparator (Schema.TaggedClass)

```text
Comparator
├── operator: "=" | ">" | ">=" | "<" | "<="
└── version: SemVer
```

### ComparatorSet

`ReadonlyArray<Comparator>` — implicit AND (all must match).

### Range (Schema.TaggedClass)

```text
Range
└── sets: ReadonlyArray<ComparatorSet>
```

Implicit OR — any set can match. Tilde, caret, x-ranges, and hyphen ranges
are desugared to primitive comparators during parsing.

### VersionDiff

```text
VersionDiff
├── type: "major" | "minor" | "patch" | "prerelease" | "build" | "none"
├── from: SemVer
├── to: SemVer
├── major: number   (delta)
├── minor: number
└── patch: number
```

## Error Model

All errors extend `TaggedError`.

### Parsing Errors

| Error | Fields | When |
| --- | --- | --- |
| `InvalidVersionError` | `input`, `position?` | Version string fails grammar |
| `InvalidRangeError` | `input`, `position?` | Range expression fails grammar |
| `InvalidComparatorError` | `input`, `position?` | Single comparator malformed |
| `InvalidPrereleaseError` | `input` | Prerelease segment violates spec |

### Resolution Errors

| Error | Fields | When |
| --- | --- | --- |
| `UnsatisfiedRangeError` | `range`, `available` | No version satisfies range |
| `VersionNotFoundError` | `version` | Exact version not in cache |
| `EmptyCacheError` | — | Cache has no versions |

### Constraint Errors

| Error | Fields | When |
| --- | --- | --- |
| `UnsatisfiableConstraintError` | `constraints` | Multiple ranges have no overlap |
| `InvalidBumpError` | `version`, `type` | Bump not possible |

## Parser

### SemVerParser Service

```text
SemVerParser
├── parseVersion(input: string): Effect<SemVer, InvalidVersionError>
├── parseRange(input: string): Effect<Range, InvalidRangeError>
├── parseComparator(input: string): Effect<Comparator, InvalidComparatorError>
```

Implementation: recursive descent parser walking the SemVer 2.0.0 BNF grammar
character by character. No regex. Produces precise error positions.

### Range Grammar

- Primitives: `>=1.2.3`, `<2.0.0`, `=1.0.0`
- Hyphen ranges: `1.2.3 - 2.0.0`
- X-ranges: `1.2.x`, `1.x`, `*`
- Tilde: `~1.2.3`
- Caret: `^1.2.3`
- Unions: `>=1.0.0 <2.0.0 || >=3.0.0`

All syntactic sugar desugared to `ComparatorSet` during parsing.

## Core Operations

### Comparison (pure functions)

```text
SemVer.compare(a, b): -1 | 0 | 1
SemVer.equal(a, b): boolean
SemVer.gt / gte / lt / lte / neq
SemVer.sort(versions): Array<SemVer>
SemVer.rsort(versions): Array<SemVer>
SemVer.max(versions): SemVer
SemVer.min(versions): SemVer
```

Also exposed as `Order<SemVer>` for Effect's `Array.sort`, `SortedSet`, etc.

### Range Matching

```text
Range.satisfies(version, range): boolean
Range.filter(versions, range): Array<SemVer>
Range.maxSatisfying(versions, range): Option<SemVer>
Range.minSatisfying(versions, range): Option<SemVer>
```

### Range Algebra

```text
Range.intersect(a, b): Effect<Range, UnsatisfiableConstraintError>
Range.union(a, b): Effect<Range, never>
Range.simplify(range): Effect<Range, never>
Range.isSubset(sub, sup): boolean
Range.equivalent(a, b): boolean
```

### Diffing

```text
SemVer.diff(a, b): VersionDiff
```

## VersionCache Service

```text
VersionCache
├── load(versions): Effect<void, never>
├── add(version): Effect<void, never>
├── remove(version): Effect<void, never>
├── versions: Effect<ReadonlyArray<SemVer>, EmptyCacheError>
│
├── resolve(range): Effect<SemVer, UnsatisfiedRangeError>
├── resolveString(input): Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError>
├── filter(range): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
├── satisfies(version, range): Effect<boolean, never>
├── latest(): Effect<SemVer, EmptyCacheError>
├── oldest(): Effect<SemVer, EmptyCacheError>
│
├── groupBy(strategy): Effect<Map<string, ReadonlyArray<SemVer>>, EmptyCacheError>
├── latestByMajor(): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
├── latestByMinor(): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
│
├── diff(a, b): Effect<VersionDiff, VersionNotFoundError>
├── next(version): Effect<Option<SemVer>, VersionNotFoundError>
├── prev(version): Effect<Option<SemVer>, VersionNotFoundError>
```

Backed by `Ref<SortedSet<SemVer>>`. Multiple caches coexist via Effect's
service model.

## Package Structure

```text
semver-effect/
├── package.json              (effect as peer dependency)
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts              (public barrel export)
│   ├── SemVer.ts
│   ├── Range.ts
│   ├── Comparator.ts
│   ├── VersionDiff.ts
│   ├── Parser.ts
│   ├── VersionCache.ts
│   ├── errors.ts
│   ├── order.ts
│   ├── internal/
│   │   ├── grammar.ts
│   │   ├── desugar.ts
│   │   └── normalize.ts
│   └── __tests__/
│       ├── SemVer.test.ts
│       ├── Range.test.ts
│       ├── Parser.test.ts
│       ├── VersionCache.test.ts
│       ├── order.test.ts
│       └── errors.test.ts
```

### Build

- ESM-only, ES2022 target
- `effect` as peer dependency
- No CJS, no dual build
