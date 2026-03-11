---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 95
related:
  - architecture.md
  - data-model.md
  - parser.md
dependencies: []
---

# Semver Effect - Error Model

Typed error hierarchy for semver-effect, providing rich context for every
failure mode across parsing, resolution, constraint, and fetch operations.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Error Hierarchy](#error-hierarchy)
5. [Error Categories](#error-categories)
   - [Parsing Errors](#parsing-errors)
   - [Resolution Errors](#resolution-errors)
   - [Constraint Errors](#constraint-errors)
   - [Fetch Errors](#fetch-errors)
6. [Field Specifications](#field-specifications)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Related Documentation](#related-documentation)

---

## Overview

semver-effect uses a flat hierarchy of TaggedError subclasses to represent
every failure that can occur during version parsing, range resolution,
constraint solving, and external fetching. Each error carries domain-specific
fields that give callers enough context to produce actionable diagnostics
without inspecting the error message string.

**Key principles:**

- Every error extends `Data.TaggedError` from Effect, giving it a `_tag`
  discriminator for pattern matching
- Errors are values, not exceptions -- they flow through Effect's typed
  error channel (`E` in `Effect<A, E, R>`)
- No error uses a generic message string as its primary payload; structured
  fields come first
- Parse errors carry optional `position` for precise diagnostics
- Resolution and constraint errors carry the domain objects that caused the
  failure
- Every error derives its `message` via a getter from structured fields

**Error count:** 10 error classes total (4 parsing + 3 resolution +
2 constraint + 1 fetch).

---

## Current State

All 10 error classes are implemented, each in its own file under `src/errors/`.
Every error uses the split base pattern for api-extractor compatibility.

### Implementation Status

| Error Class | Status | Location |
| :-- | :-- | :-- |
| InvalidVersionError | Implemented | `src/errors/InvalidVersionError.ts` |
| InvalidRangeError | Implemented | `src/errors/InvalidRangeError.ts` |
| InvalidComparatorError | Implemented | `src/errors/InvalidComparatorError.ts` |
| InvalidPrereleaseError | Implemented | `src/errors/InvalidPrereleaseError.ts` |
| UnsatisfiedRangeError | Implemented | `src/errors/UnsatisfiedRangeError.ts` |
| VersionNotFoundError | Implemented | `src/errors/VersionNotFoundError.ts` |
| EmptyCacheError | Implemented | `src/errors/EmptyCacheError.ts` |
| UnsatisfiableConstraintError | Implemented | `src/errors/UnsatisfiableConstraintError.ts` |
| InvalidBumpError | Implemented | `src/errors/InvalidBumpError.ts` |
| VersionFetchError | Implemented | `src/errors/VersionFetchError.ts` |

---

## Rationale

### Why TaggedError Instead of Plain Errors

All errors extend `Data.TaggedError` for:

1. **Typed error channel:** Participates in `Effect<A, E, R>` type tracking.
2. **Pattern matching via `_tag`:** Enables `Effect.catchTag("InvalidVersionError", ...)`.
3. **Structural equality:** Simplifies testing.
4. **Consistency:** Matches the data model convention (Schema.TaggedClass).

### Why Structured Fields Instead of Message Strings

Every error carries typed fields as its primary payload. The `message` is
derived from these fields via a getter, never accepted as a constructor
parameter (except VersionFetchError which takes message directly). This
ensures programmatic access, composable diagnostics, and stable contracts.

### Why Typed Error Channels Solve the satisfies() Ambiguity

In node-semver, `semver.satisfies("invalid", "^1.0.0")` returns `false`,
which is indistinguishable from `semver.satisfies("2.0.0", "^1.0.0")`. Our
API separates these concerns: parsing failures produce typed errors in the
error channel, while range non-matches return `false` in the success channel.

### Why Optional Position on Parse Errors

The `position` field is optional on parsing errors because some failures
(like empty input) do not have a meaningful character position. When present,
it is a zero-based character offset into the input string.

---

## Error Hierarchy

```text
Data.TaggedError
 |
 +-- Parsing Errors
 |    +-- InvalidVersionError      { input, position? }
 |    +-- InvalidRangeError         { input, position? }
 |    +-- InvalidComparatorError    { input, position? }
 |    +-- InvalidPrereleaseError    { input }
 |
 +-- Resolution Errors
 |    +-- UnsatisfiedRangeError     { range, available }
 |    +-- VersionNotFoundError      { version }
 |    +-- EmptyCacheError           { }
 |
 +-- Constraint Errors
 |    +-- UnsatisfiableConstraintError  { constraints }
 |    +-- InvalidBumpError              { version, type }
 |
 +-- Fetch Errors
      +-- VersionFetchError         { source, message, cause? }
```

The hierarchy is flat -- no intermediate abstract class. Each error's `_tag`
is the class name itself.

### Split Base Pattern

Every error file uses a "split base" pattern:

```ts
import { Data } from "effect";

/** @internal */
export const InvalidVersionErrorBase = Data.TaggedError("InvalidVersionError");

export class InvalidVersionError extends InvalidVersionErrorBase<{
  readonly input: string;
  readonly position?: number;
}> {
  get message(): string {
    const base = `Invalid version string: "${this.input}"`;
    return this.position !== undefined ? `${base} at position ${this.position}` : base;
  }
}
```

**Why the split:** api-extractor needs a stable, nameable reference for the
base expression. The `@internal` JSDoc tag keeps the base out of the public
API surface.

---

## Error Categories

### Parsing Errors

Produced by the parser when input strings fail to conform to the grammar.

#### InvalidVersionError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidVersionError"` | Discriminator |
| `input` | `string` | The version string that failed to parse |
| `position` | `number \| undefined` | Character offset where parsing failed |

**Message format:** `Invalid version string: "<input>" [at position N]`

**When raised:** `parseVersion()` cannot produce a valid SemVer.

#### InvalidRangeError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidRangeError"` | Discriminator |
| `input` | `string` | The range expression that failed to parse |
| `position` | `number \| undefined` | Character offset where parsing failed |

**Message format:** `Invalid range expression: "<input>" [at position N]`

**When raised:** `parseRange()` cannot produce a valid Range.

#### InvalidComparatorError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidComparatorError"` | Discriminator |
| `input` | `string` | The comparator string that failed to parse |
| `position` | `number \| undefined` | Character offset where parsing failed |

**Message format:** `Invalid comparator: "<input>" [at position N]`

**When raised:** `parseComparator()` cannot produce a valid Comparator.

#### InvalidPrereleaseError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidPrereleaseError"` | Discriminator |
| `input` | `string` | The prerelease segment that violates the spec |

**Message format:** `Invalid prerelease identifier: "<input>"`

**When raised:** A prerelease identifier violates SemVer 2.0.0 rules.
Does not carry `position` because the prerelease segment is identified
as a whole unit.

---

### Resolution Errors

Produced by the VersionCache service when queries cannot be satisfied.

#### UnsatisfiedRangeError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"UnsatisfiedRangeError"` | Discriminator |
| `range` | `Range` | The range that no cached version satisfies |
| `available` | `ReadonlyArray<SemVer>` | Snapshot of versions in the cache |

**Message format:** `No version satisfies range <range> (N version(s) available)`

**When raised:** `VersionCache.resolve()` or `resolveString()` finds no match.

#### VersionNotFoundError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"VersionNotFoundError"` | Discriminator |
| `version` | `SemVer` | The exact version that was not found |

**Message format:** `Version not found in cache: <version>`

**When raised:** Cache operations requiring a specific version (`diff`,
`next`, `prev`) fail to find it.

#### EmptyCacheError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"EmptyCacheError"` | Discriminator |

**Message format:** `Version cache is empty`

**When raised:** Cache operations requiring at least one version (`versions`,
`latest`, `oldest`, `filter`, `groupBy`, `latestByMajor`, `latestByMinor`)
are called on an empty cache. No additional fields.

---

### Constraint Errors

Arise from range algebra or version mutation operations.

#### UnsatisfiableConstraintError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"UnsatisfiableConstraintError"` | Discriminator |
| `constraints` | `ReadonlyArray<Range>` | The ranges with no overlap |

**Message format:** `No version satisfies all N constraint(s)`

**When raised:** `intersect(a, b)` determines no version can satisfy both.

#### InvalidBumpError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidBumpError"` | Discriminator |
| `version` | `SemVer` | The version that cannot be bumped |
| `type` | `string` | The bump type that was attempted |

**Message format:** `Cannot apply <type> bump to version <version>`

**When raised:** A bump operation is not valid for the given version state.

---

### Fetch Errors

Produced by VersionFetcher implementations.

#### VersionFetchError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"VersionFetchError"` | Discriminator |
| `source` | `string` | e.g., "npm", "github", "filesystem" |
| `message` | `string` | Human-readable description |
| `cause` | `unknown \| undefined` | Underlying error |

**Note:** Unlike other errors, VersionFetchError accepts `message` directly
as a constructor field because the error originates from external sources
where a derived message is not practical.

**When raised:** By consumer implementations of the VersionFetcher interface.

---

## Field Specifications

### Common Fields

| Field | Type | Present On | Description |
| :-- | :-- | :-- | :-- |
| `_tag` | string literal | All errors | Discriminator for pattern matching |
| `message` | `string` | All errors | Human-readable (derived via getter) |
| `input` | `string` | All parsing errors | Raw input that caused failure |
| `position` | `number \| undefined` | 3 of 4 parse errors | Zero-based char offset |

### Position Semantics

- `position === 0` means the parser failed at the first character
- `position === input.length` means the parser expected more input
- `position === undefined` means the failure is not character-specific

---

## Error Handling Patterns

### Catching a Specific Error

```ts
const program = parseVersion("1.2.3-01").pipe(
  Effect.catchTag("InvalidVersionError", (err) =>
    Effect.succeed(fallbackVersion)
  )
)
```

### Union Error Channels

```ts
// resolveString error type: InvalidRangeError | UnsatisfiedRangeError
const resolved = cache.resolveString("^1.0.0").pipe(
  Effect.catchTag("InvalidRangeError", (err) =>
    Effect.fail(new UserInputError(`Bad range: ${err.input}`))
  ),
  Effect.catchTag("UnsatisfiedRangeError", (err) =>
    Effect.fail(new UserInputError(`No match among ${err.available.length} versions`))
  )
)
```

### Recovering from EmptyCacheError

```ts
const versions = cache.versions.pipe(
  Effect.catchTag("EmptyCacheError", () =>
    Effect.succeed([] as ReadonlyArray<SemVer>)
  )
)
```

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture and error handling strategy
- [data-model.md](data-model.md) -- Core data types that appear as error fields
- [parser.md](parser.md) -- How parsing errors are produced with position info

---

**Document Status:** Current -- covers all 10 implemented error classes with
field specifications, message formats, handling patterns, and the split base
pattern.
