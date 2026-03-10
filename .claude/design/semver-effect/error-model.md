---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: never
completeness: 80
related:
  - architecture.md
  - data-model.md
  - parser.md
dependencies: []
---

# Semver Effect - Error Model

Typed error hierarchy for semver-effect, providing rich context for every
failure mode across parsing, resolution, and constraint operations.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Error Hierarchy](#error-hierarchy)
5. [Error Categories](#error-categories)
   - [Parsing Errors](#parsing-errors)
   - [Resolution Errors](#resolution-errors)
   - [Constraint Errors](#constraint-errors)
6. [Field Specifications](#field-specifications)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Related Documentation](#related-documentation)

---

## Overview

semver-effect uses a flat hierarchy of TaggedError subclasses to represent
every failure that can occur during version parsing, range resolution, and
constraint solving. Each error carries domain-specific fields that give
callers enough context to produce actionable diagnostics without inspecting
the error message string.

**Key principles:**

- Every error extends `Data.TaggedError` from Effect, giving it a `_tag`
  discriminator for pattern matching
- Errors are values, not exceptions -- they flow through Effect's typed
  error channel (`E` in `Effect<A, E, R>`)
- No error uses a generic message string as its primary payload; structured
  fields come first
- Parse errors carry optional `position` for precise diagnostics
- Resolution and constraint errors carry the domain objects that caused the
  failure (ranges, versions, constraints)

**When to reference this document:**

- When implementing error classes in `src/errors/`
- When writing parser code that must produce the correct error type
- When implementing VersionCache operations that fail on missing data
- When designing user-facing error messages or diagnostics
- When adding new error types to the hierarchy

---

## Current State

The error model is specified in the approved design spec but has not yet been
implemented. Each error class lives in its own file under `src/errors/` (no
barrel file). There is no `src/errors.ts` single-file module.

### Planned Error Count

- 4 parsing errors
- 3 resolution errors
- 2 constraint errors
- 9 total error classes

### Implementation Status

| Error Class | Status | Location |
| :-- | :-- | :-- |
| InvalidVersionError | Not implemented | `src/errors/InvalidVersionError.ts` |
| InvalidRangeError | Not implemented | `src/errors/InvalidRangeError.ts` |
| InvalidComparatorError | Not implemented | `src/errors/InvalidComparatorError.ts` |
| InvalidPrereleaseError | Not implemented | `src/errors/InvalidPrereleaseError.ts` |
| UnsatisfiedRangeError | Not implemented | `src/errors/UnsatisfiedRangeError.ts` |
| VersionNotFoundError | Not implemented | `src/errors/VersionNotFoundError.ts` |
| EmptyCacheError | Not implemented | `src/errors/EmptyCacheError.ts` |
| UnsatisfiableConstraintError | Not implemented | `src/errors/UnsatisfiableConstraintError.ts` |
| InvalidBumpError | Not implemented | `src/errors/InvalidBumpError.ts` |
| VersionFetchError | Not implemented | `src/errors/VersionFetchError.ts` |

---

## Rationale

### Why TaggedError Instead of Plain Errors

**Context:** Effect provides `Data.TaggedError` as the standard base for
typed errors. The alternative is plain `Error` subclasses or union types.

**Decision:** All errors extend `Data.TaggedError`.

**Justification:**

1. **Typed error channel:** `Effect<A, E, R>` tracks errors at the type level.
   TaggedError classes participate naturally in union error types, allowing
   the compiler to enforce exhaustive handling.

2. **Pattern matching via `_tag`:** Every TaggedError has a string literal
   `_tag` field. This enables `Effect.catchTag("InvalidVersionError", ...)` for
   selective recovery without `instanceof` checks.

3. **Structural equality:** TaggedError extends `Data.Error`, which provides
   structural equality out of the box. Two error instances with the same fields
   compare as equal, which simplifies testing.

4. **Consistency with data types:** The core data model (SemVer, Range,
   Comparator) already uses `Schema.TaggedClass`. Using TaggedError for the
   error side keeps the entire API within Effect's data model conventions.

### Why Structured Fields Instead of Message Strings

**Context:** Traditional error handling relies on parsing `.message` strings.

**Decision:** Every error carries typed fields as its primary payload. The
human-readable message is derived from these fields, not the other way around.

**Justification:**

1. **Programmatic access:** Callers can read `error.input` and
   `error.position` directly instead of parsing a message string.

2. **Composable diagnostics:** Upstream code can format errors for different
   audiences (CLI, JSON API, IDE tooltip) using the structured fields.

3. **Stable contract:** Field names and types form a stable API. Message
   wording can change without breaking consumers.

4. **Message getter pattern:** Each error class derives its `message` via a
   getter that composes the human-readable string from structured fields.
   The `message` is never accepted as a constructor parameter. This ensures
   the message always reflects the actual field values and cannot drift out
   of sync with the structured data.

   ```ts
   get message(): string {
     const pos = this.position !== undefined ? ` at position ${this.position}` : ""
     return `Invalid version string: "${this.input}"${pos}`
   }
   ```

   This pattern applies to every error class: the getter reads from `this`
   fields and returns a formatted string. Callers who need programmatic
   access use the fields directly; callers who need a human-readable summary
   use `.message`.

### Why Typed Error Channels Solve the satisfies() Ambiguity

**Context:** In node-semver, `semver.satisfies("invalid", "^1.0.0")` returns
`false`, which is indistinguishable from `semver.satisfies("2.0.0", "^1.0.0")`
also returning `false`. Callers cannot tell whether the version did not match
the range or the input was unparseable. This is node-semver's second most
common pain point after opaque error messages.

**Decision:** Our API separates these concerns through Effect's typed error
channel. Parsing failures produce `InvalidVersionError` or `InvalidRangeError`
in the error channel, while a successful parse that does not match the range
returns `false` (or an empty result) in the success channel.

**Justification:**

1. **No silent swallowing:** Invalid input is always surfaced as a typed error,
   never silently collapsed into a `false` return value.

2. **Distinct recovery paths:** Callers can use `Effect.catchTag` to handle
   `InvalidRangeError` (user gave bad input) differently from a successful
   `false` result (input is valid but does not match).

3. **Composable pipelines:** Because the error is in the `E` channel, it
   composes naturally with other Effect operations. A pipeline can accumulate
   parsing errors separately from matching results without custom sentinel
   values.

### Why Optional Position on Parse Errors

**Context:** The recursive descent parser can always report where it stopped,
but some error conditions (like an entirely empty input) do not have a
meaningful character position.

**Decision:** The `position` field is optional (`position?: number`) on
parsing errors.

**Justification:**

- When the parser fails mid-input, position points to the offending character
- When the input is empty or the failure is structural (e.g., a prerelease
  segment that is syntactically valid but semantically wrong), position may
  be omitted
- Making it optional avoids forcing callers to handle a meaningless `0` value

---

## Error Hierarchy

Each error lives in its own file under `src/errors/` and all share a common
structure:

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
      +-- UnsatisfiableConstraintError  { constraints }
      +-- InvalidBumpError              { version, type }
```

The hierarchy is flat -- there is no intermediate abstract class between
`Data.TaggedError` and the concrete error classes. This keeps the type
unions simple and avoids diamond inheritance issues.

Each error's `_tag` field is the class name itself (e.g.,
`_tag: "InvalidVersionError"`), which enables direct pattern matching with
`Effect.catchTag`.

### Split Base Pattern

Every error file uses a "split base" pattern required for api-extractor
compatibility. The `Data.TaggedError(...)` call is assigned to a `*Base`
constant marked `@internal`, and the public class extends that base:

```ts
import { Data } from "effect";

/** @internal */
export const InvalidVersionErrorBase = Data.TaggedError("InvalidVersionError");

export class InvalidVersionError extends InvalidVersionErrorBase<{
  readonly input: string;
  readonly position?: number;
}> {}
```

**Why the split:** api-extractor's declaration bundler needs a stable,
nameable reference for the base expression. Without the intermediate
`*Base` constant, the bundler encounters an un-nameable inline call
(`Data.TaggedError("...")`) in the `extends` clause and cannot emit a
clean `.d.ts` rollup. The `@internal` JSDoc tag keeps the base out of
the public API surface while still exporting it for the bundler.

**No barrel file:** Imports reference individual source files directly
(e.g., `from "./errors/InvalidVersionError.js"`). There is no
`src/errors/index.ts` barrel re-export file.

---

## Error Categories

### Parsing Errors

Parsing errors are produced by the `SemVerParser` service when input strings
fail to conform to the SemVer 2.0.0 grammar. They all carry the original
`input` string and an optional `position` indicating where the parser
stopped.

#### InvalidVersionError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidVersionError"` | Discriminator |
| `input` | `string` | The version string that failed to parse |
| `position` | `number \| undefined` | Character offset where parsing failed |

**When raised:** `SemVerParser.parseVersion()` cannot produce a valid SemVer
from the input string. Examples:

- `"not.a.version"` -- no numeric segments found
- `"1.2"` -- missing patch component
- `"1.2.3.4"` -- too many numeric segments
- `"01.2.3"` -- leading zeros in numeric segment
- `"1.2.99999999999999999"` -- numeric identifier exceeds
  `Number.MAX_SAFE_INTEGER`

**Integer overflow:** Rather than introducing a separate `IntegerOverflowError`,
integer overflow in numeric identifiers (major, minor, patch, or numeric
prerelease identifiers) is reported as an `InvalidVersionError` with a
descriptive message derived from the structured fields (e.g., "numeric
identifier exceeds safe integer limit at position N"). This keeps the error
hierarchy flat and avoids proliferating error types for what is fundamentally
still an invalid version string. The `position` field points to the start of
the overflowing numeric segment, giving callers precise diagnostic information.

**Typical Effect signature:**

```text
parseVersion(input: string): Effect<SemVer, InvalidVersionError>
```

#### InvalidRangeError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidRangeError"` | Discriminator |
| `input` | `string` | The range expression that failed to parse |
| `position` | `number \| undefined` | Character offset where parsing failed |

**When raised:** `SemVerParser.parseRange()` cannot produce a valid Range
from the input expression. Examples:

- `">=1.2.3 <"` -- incomplete comparator after operator
- `"|| >=1.0.0"` -- leading empty set in union
- `"1.2.3 - "` -- incomplete hyphen range

**Typical Effect signature:**

```text
parseRange(input: string): Effect<Range, InvalidRangeError>
```

#### InvalidComparatorError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidComparatorError"` | Discriminator |
| `input` | `string` | The comparator string that failed to parse |
| `position` | `number \| undefined` | Character offset where parsing failed |

**When raised:** `SemVerParser.parseComparator()` cannot produce a valid
Comparator from the input string. Examples:

- `"!= 1.2.3"` -- invalid operator
- `">= "` -- operator with no version

**Typical Effect signature:**

```text
parseComparator(input: string): Effect<Comparator, InvalidComparatorError>
```

#### InvalidPrereleaseError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidPrereleaseError"` | Discriminator |
| `input` | `string` | The prerelease segment that violates the spec |

**When raised:** A prerelease identifier is syntactically present but
violates SemVer 2.0.0 rules. Examples:

- `"1.2.3-01"` -- numeric prerelease identifier with leading zero
- `"1.2.3-"` -- empty prerelease after hyphen
- `"1.2.3-a..b"` -- empty identifier between dots

**Note:** This error does not carry `position` because the prerelease segment
is identified as a whole unit. The `input` field contains the offending
prerelease string (not the entire version string).

**Typical context:** Raised inside the parser as a sub-error when
`parseVersion` encounters a prerelease section that passes initial structural
checks but fails semantic validation.

---

### Resolution Errors

Resolution errors are produced by the `VersionCache` service when queries
against the cached version set cannot be satisfied.

#### UnsatisfiedRangeError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"UnsatisfiedRangeError"` | Discriminator |
| `range` | `Range` | The range that no cached version satisfies |
| `available` | `ReadonlyArray<SemVer>` | Snapshot of versions in the cache |

**When raised:** `VersionCache.resolve(range)` or
`VersionCache.resolveString(input)` finds no version in the cache that
matches the given range.

**Why `available` is included:** Callers often need to suggest the closest
matching version or explain why the range could not be satisfied. Including
the available versions avoids a second round-trip to the cache.

**Typical Effect signature:**

```text
resolve(range: Range): Effect<SemVer, UnsatisfiedRangeError>
```

#### VersionNotFoundError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"VersionNotFoundError"` | Discriminator |
| `version` | `SemVer` | The exact version that was not found |

**When raised:** An operation that requires a specific version to exist in
the cache fails to find it. Examples:

- `VersionCache.diff(a, b)` -- either `a` or `b` is not in the cache
- `VersionCache.next(version)` -- `version` is not in the cache
- `VersionCache.prev(version)` -- `version` is not in the cache

**Typical Effect signature:**

```text
diff(a: SemVer, b: SemVer): Effect<VersionDiff, VersionNotFoundError>
next(version: SemVer): Effect<Option<SemVer>, VersionNotFoundError>
```

#### EmptyCacheError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"EmptyCacheError"` | Discriminator |

**When raised:** A VersionCache operation that requires at least one version
in the cache is called on an empty cache. Examples:

- `VersionCache.versions` -- cache is empty
- `VersionCache.latest()` -- cache is empty
- `VersionCache.oldest()` -- cache is empty
- `VersionCache.groupBy(strategy)` -- cache is empty
- `VersionCache.filter(range)` -- cache is empty

**Note:** This error carries no fields beyond `_tag`. The empty state is
self-explanatory, and adding fields would not provide actionable information.

**Typical Effect signature:**

```text
latest(): Effect<SemVer, EmptyCacheError>
versions: Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

---

### Constraint Errors

Constraint errors arise from higher-level operations that combine ranges
or attempt version mutations that violate semantic versioning rules.

#### UnsatisfiableConstraintError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"UnsatisfiableConstraintError"` | Discriminator |
| `constraints` | `ReadonlyArray<Range>` | The ranges with no overlap |

**When raised:** `Range.intersect(a, b)` determines that no version can
satisfy all provided ranges simultaneously.

**Example:** Intersecting `>=2.0.0` with `<1.5.0` produces an empty set.

**Why an array:** The `constraints` field holds all participating ranges,
not just a pair, to support future multi-range constraint solving where
more than two ranges may be involved.

**Typical Effect signature:**

```text
Range.intersect(a: Range, b: Range): Effect<Range, UnsatisfiableConstraintError>
```

#### InvalidBumpError

| Property | Type | Description |
| :-- | :-- | :-- |
| `_tag` | `"InvalidBumpError"` | Discriminator |
| `version` | `SemVer` | The version that cannot be bumped |
| `type` | `string` | The bump type that was attempted |

**When raised:** A bump operation is not valid for the given version state.
Examples:

- `SemVer.bump.release(v)` on a version that has no prerelease (it is
  already a release)
- `SemVer.bump.prerelease(v, id)` with an invalid prerelease identifier

**The `type` field** contains the bump kind that was requested:
`"major"`, `"minor"`, `"patch"`, `"prerelease"`, or `"release"`.

**Typical Effect signature:**

```text
SemVer.bump.release(v: SemVer): Effect<SemVer, InvalidBumpError>
```

---

## Field Specifications

### Common Fields

| Field | Type | Present On | Description |
| :-- | :-- | :-- | :-- |
| `_tag` | string literal | All errors | Discriminator for pattern matching |
| `message` | `string` | All errors | Human-readable description (derived) |
| `input` | `string` | All parsing errors | The raw input that caused the failure |
| `position` | `number \| undefined` | Parse errors except InvalidPrereleaseError | Zero-based character offset |

### Domain Object Fields

| Field | Type | Present On | Description |
| :-- | :-- | :-- | :-- |
| `range` | `Range` | UnsatisfiedRangeError | The unsatisfied range |
| `available` | `ReadonlyArray<SemVer>` | UnsatisfiedRangeError | Cache snapshot |
| `version` | `SemVer` | VersionNotFoundError, InvalidBumpError | The relevant version |
| `constraints` | `ReadonlyArray<Range>` | UnsatisfiableConstraintError | Conflicting ranges |
| `type` | `string` | InvalidBumpError | Bump type attempted |

### Position Semantics

The `position` field on parsing errors is a zero-based character offset into
the `input` string:

- `position === 0` means the parser failed at the first character
- `position === input.length` means the parser expected more input
- `position === undefined` means the failure is not attributable to a
  specific character (e.g., empty input, structural mismatch)

Callers can use `position` to render a caret indicator:

```text
Input: 1.2.3.4
            ^
Error: InvalidVersionError at position 5
```

### Pretty-Printing with Caret Indicators

A `prettyPrint()` utility function formats parsing errors with visual position
indicators that show exactly where the input went wrong. This is a high-value
developer experience feature -- node-semver's most common pain point (after
prerelease handling) is its opaque "Invalid Version" error message that gives
no indication of what part of the input is problematic.

**Output format:**

```text
InvalidVersionError: Expected numeric patch version
  Input: 1.2.abc
             ^^^
  Position: 4
```

**Design notes:**

- `prettyPrint()` is a standalone utility, not a method on the error class
  itself, to keep error classes focused on data
- It accepts any parsing error (any error with `input` and optional `position`)
- When `position` is defined, the caret line underlines the offending
  characters starting at that offset
- When `position` is undefined, the caret line is omitted
- The first line includes the error `_tag` and the derived `message`
- Indented lines show the input string and position for visual alignment
- This utility is intended for CLI output and developer tooling; structured
  consumers should use the error fields directly

**Typical usage:**

```ts
import { prettyPrint } from "semver-effect"

SemVerParser.parseVersion("1.2.abc").pipe(
  Effect.catchTag("InvalidVersionError", (err) => {
    console.error(prettyPrint(err))
    return Effect.fail(err)
  })
)
```

---

## Error Handling Patterns

### Catching a Specific Error

Use `Effect.catchTag` to handle one error type and let others propagate:

```ts
import { Effect } from "effect"
import { SemVerParser } from "semver-effect"

const program = SemVerParser.parseVersion("1.2.3-01").pipe(
  Effect.catchTag("InvalidVersionError", (err) =>
    Effect.succeed(fallbackVersion)
  )
)
```

### Exhaustive Matching

Use `Effect.match` or `Effect.matchEffect` to handle all outcomes:

```ts
const result = SemVerParser.parseVersion(input).pipe(
  Effect.match({
    onSuccess: (version) => `Parsed: ${version}`,
    onFailure: (err) => `Failed: ${err.input} at ${err.position}`,
  })
)
```

### Union Error Channels

Operations that can fail with multiple error types produce a union in the
error channel:

```ts
// resolveString has error type: InvalidRangeError | UnsatisfiedRangeError
const resolved = VersionCache.resolveString("^1.0.0").pipe(
  Effect.catchTag("InvalidRangeError", (err) =>
    Effect.fail(new UserInputError(`Bad range: ${err.input}`))
  ),
  Effect.catchTag("UnsatisfiedRangeError", (err) =>
    Effect.fail(new UserInputError(`No match among ${err.available.length} versions`))
  )
)
```

### Mapping Errors for API Boundaries

At API boundaries, map domain errors to transport errors:

```ts
const handler = SemVerParser.parseVersion(input).pipe(
  Effect.mapError((err) => ({
    code: "INVALID_VERSION",
    message: err.message,
    input: err.input,
    position: err.position,
  }))
)
```

### Recovering from EmptyCacheError

For operations where an empty cache is expected (e.g., first load):

```ts
const versions = VersionCache.versions.pipe(
  Effect.catchTag("EmptyCacheError", () =>
    Effect.succeed([] as ReadonlyArray<SemVer>)
  )
)
```

---

## Related Documentation

**Design Spec:**

- [semver-effect Design Spec](../../../docs/specs/semver-effect-design.md) --
  Approved specification containing the canonical error table

**Architecture:**

- [architecture.md](architecture.md) -- System architecture overview
  including error handling strategy and component structure

**Planned:**

- `data-model.md` -- Core data types (SemVer, Range, Comparator, VersionDiff)
  that appear as fields in resolution and constraint errors
- `parser.md` -- Parser design covering how parsing errors are produced with
  position information

---

**Document Status:** Current -- covers the complete error hierarchy, field
specifications, handling patterns, message getter pattern, pretty-printing
diagnostics, integer overflow handling, and error channel clarity.
Implementation has not yet begun.

**Next Steps:** Implement all nine error classes as individual files under
`src/errors/` using the split base pattern. Add unit tests in
`__test__/errors.test.ts` covering construction, field access, pattern
matching, and structural equality.
