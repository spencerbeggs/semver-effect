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
  - parser.md
  - operations.md
  - error-model.md
  - semver-compliance.md
dependencies:
  - parser.md
  - operations.md
  - error-model.md
---

# node-semver Divergences

Detailed comparison between semver-effect and node-semver (npm/node-semver),
documenting behavioral differences, architectural choices, and areas of
compatibility.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Compatibility Summary](#compatibility-summary)
4. [Parsing Divergences](#parsing-divergences)
5. [API Design Divergences](#api-design-divergences)
6. [Range Behavior](#range-behavior)
7. [Error Handling](#error-handling)
8. [Data Model Divergences](#data-model-divergences)
9. [Operations Divergences](#operations-divergences)
10. [Features Not Ported](#features-not-ported)
11. [Features Added](#features-added)
12. [node-semver Bug Fixes](#node-semver-bug-fixes)
13. [Related Documentation](#related-documentation)

---

## Overview

semver-effect is not a drop-in replacement for node-semver. It is a
ground-up reimplementation with different design goals: strict SemVer 2.0.0
only, Effect-native API, typed errors, immutable data types, and no loose
mode. Where range behavior is compatible, it follows node-semver conventions.
Where node-semver has known bugs or design limitations, semver-effect
diverges intentionally.

**Guiding principle:** Compatible range semantics where possible, strict
parsing and typed errors everywhere, no backward-compatible baggage.

---

## Current State

All divergences documented here are implemented and tested. The
`spec-compliance.test.ts` test suite includes fixtures ported from
node-semver (strict-mode entries only).

---

## Compatibility Summary

| Area | Compatibility | Notes |
| :--- | :--- | :--- |
| Version parsing (strict) | Compatible | Same set of accepted strings |
| Version parsing (loose) | Not supported | No loose mode |
| Version precedence | Compatible | Same ordering for valid versions |
| Range syntax | Compatible | Same grammar and desugaring rules |
| Range satisfaction | Compatible | Same results for strict inputs |
| Prerelease matching | Compatible | Same-tuple policy enforced |
| Caret/tilde desugaring | Compatible | Same output comparators |
| Bump operations | Compatible | Same version outputs for valid inputs |
| Error handling | Different | Typed errors vs null/throw |
| API shape | Different | Effect-native vs imperative |
| Data model | Different | Immutable Schema.TaggedClass vs mutable class |
| Coercion | Not supported | No equivalent |
| v-prefix tolerance | Not supported | Always rejected |

---

## Parsing Divergences

### No Loose Mode

node-semver supports two parsing modes:

- **Strict mode:** Rejects inputs not conforming to SemVer 2.0.0 grammar
- **Loose mode:** Accepts various non-standard inputs via relaxed regex

semver-effect has strict mode only. There is no `loose` option and no
equivalent of `semver.coerce()`.

**Inputs accepted by node-semver loose but rejected by semver-effect:**

| Input | node-semver loose | semver-effect |
| :--- | :--- | :--- |
| `v1.2.3` | `1.2.3` | `InvalidVersionError` at position 0 |
| `V1.2.3` | `1.2.3` | `InvalidVersionError` at position 0 |
| `=1.2.3` | `1.2.3` | `InvalidVersionError` at position 0 |
| `v=1.2.3` | `1.2.3` | `InvalidVersionError` at position 0 |
| `1.2.3foo` | `1.2.3` | `InvalidVersionError` at trailing chars |
| ` 1.2.3 ` | `1.2.3` | `InvalidVersionError` at position 0 |
| `01.02.03` | `1.2.3` | `InvalidVersionError` at position 0 |

### No Coercion

node-semver provides `semver.coerce()` which extracts a version from
arbitrary strings:

```javascript
semver.coerce("v1")        // => "1.0.0"
semver.coerce("42.6.7.9.3-alpha") // => "42.6.7"
```

semver-effect has no coercion equivalent. Inputs must be valid SemVer 2.0.0
strings.

### Strict v-Prefix Rejection

node-semver accepts `v1.2.3` even in strict mode in some contexts (range
parsing). semver-effect rejects `v` and `V` prefixes immediately at
position 0 in all contexts.

### Parser Technology

node-semver uses regex-based parsing. semver-effect uses a hand-written
recursive descent parser. This produces:

- Precise error positions (zero-based character offset)
- Better error messages
- No ReDoS vulnerability surface
- Slightly more code but more maintainable grammar mapping

### Integer Overflow

node-semver checks `MAX_SAFE_INTEGER` for version components.
semver-effect does the same via `Number.isSafeInteger()` after parsing.

---

## API Design Divergences

### Effect-Native Returns

Every node-semver function returns a plain value or `null`. Every
semver-effect function returns an `Effect`.

| node-semver | semver-effect |
| :--- | :--- |
| `semver.valid("1.2.3") // "1.2.3"` | `parseVersion("1.2.3") // Effect<SemVer, InvalidVersionError>` |
| `semver.valid("bad") // null` | `parseVersion("bad") // Effect<never, InvalidVersionError>` |
| `semver.satisfies("1.2.3", "^1.0.0") // true` | `satisfies(v, range) // boolean` (pure, no Effect) |
| `semver.maxSatisfying(vs, "^1.0.0") // "1.2.3"` | `maxSatisfying(vs, range) // Option<SemVer>` |
| `semver.inc("1.2.3", "minor") // "1.3.0"` | `bumpMinor(v) // SemVer` (pure, no Effect) |

**Key difference:** Parsing is effectful (can fail), but comparison and
matching are pure functions. node-semver mixes parsing into comparison
functions (accepts string arguments), which means comparison can silently
fail.

### No String Overloads

node-semver functions accept `string | SemVer` parameters, parsing strings
internally:

```javascript
semver.gt("1.2.3", "1.0.0") // true (parses both strings)
semver.gt("bad", "1.0.0")   // false (silently fails)
```

semver-effect requires pre-parsed `SemVer` instances:

```typescript
gt(v1, v2) // both must be SemVer instances
```

This eliminates the ambiguity where `false` could mean "not greater" or
"invalid input." Parsing is always explicit.

### Service-Based Parser

node-semver exposes standalone functions. semver-effect exposes both:

- **Standalone convenience functions:** `parseVersion`, `parseRange`,
  `parseComparator` (no Layer required)
- **Service interface:** `SemVerParser` via `Context.GenericTag` + Layer
  pattern (for dependency injection and testing)

### Dual Calling Convention

All binary operations support both data-first and data-last styles via
`Function.dual`:

```typescript
gt(v1, v2)         // data-first
pipe(v1, gt(v2))   // data-last
```

node-semver only supports data-first.

---

## Range Behavior

### Range Syntax Compatibility

semver-effect supports the same range syntax as node-semver:

- Comparator operators: `>`, `>=`, `<`, `<=`, `=`
- Caret ranges: `^1.2.3`
- Tilde ranges: `~1.2.3`
- X-ranges: `*`, `1.x`, `1.2.*`
- Hyphen ranges: `1.2.3 - 2.3.4`
- OR unions: `>=1.0.0 || >=2.0.0`
- Implicit AND: `>=1.0.0 <2.0.0`

### Desugaring Compatibility

Desugaring rules match node-semver exactly, including:

- The `-0` trick for upper bounds (`^1.2.3` -> `>=1.2.3 <2.0.0-0`)
- Version 0.x caret convention (`^0.1.2` -> `>=0.1.2 <0.2.0-0`)
- Partial version expansion (`1.2` -> `>=1.2.0 <1.3.0-0`)
- Empty string as match-all (`""` -> `>=0.0.0`)

### No `includePrerelease` Option

node-semver supports an `includePrerelease` option that changes range
matching behavior. semver-effect does not have this option. The strict
same-tuple prerelease matching policy is always enforced:

- A prerelease version only satisfies a comparator if the comparator's
  version shares the same `[major, minor, patch]` tuple AND has a non-empty
  prerelease
- `3.0.0-beta.1` satisfies `>=3.0.0-alpha.1` (same tuple)
- `3.0.0-beta.1` does NOT satisfy `>=2.9.0` (different tuple)

This eliminates a class of misconfiguration errors documented in node-semver
issues #557, #512, #396, #345.

### `~>` Not Supported

The Ruby-style pessimistic constraint operator `~>` is explicitly rejected.
`~>1.2.3` produces an `InvalidRangeError` at the `>` character. node-semver
also does not support this.

### Normalization

After parsing, ranges are normalized:

- Comparators within a set are sorted by operator weight
  (`>=` > `>` > `=` > `<` > `<=`)
- Duplicate comparators are removed

node-semver does not normalize ranges after parsing.

---

## Error Handling

### Typed Errors vs Null Returns

This is the most significant behavioral divergence.

**node-semver pattern:**

```javascript
semver.valid("bad")           // null (no reason given)
semver.satisfies("bad", "^1") // false (invalid? or just doesn't match?)
semver.inc("1.0.0", "bad")   // null (what went wrong?)
```

**semver-effect pattern:**

```typescript
parseVersion("bad")
// Effect<never, InvalidVersionError{ input: "bad", position: 3 }>

satisfies(v, range)
// boolean -- only called with pre-parsed SemVer, never ambiguous

bumpMinor(v)
// SemVer -- always succeeds on valid input
```

### 10 Typed Error Classes

semver-effect provides 10 distinct error types where node-semver uses `null`
or generic `TypeError`:

| semver-effect Error | node-semver Equivalent |
| :--- | :--- |
| `InvalidVersionError` | `null` from `valid()` or `TypeError` |
| `InvalidRangeError` | `null` from `validRange()` or `TypeError` |
| `InvalidComparatorError` | `TypeError` |
| `InvalidPrereleaseError` | `null` from `inc()` |
| `UnsatisfiedRangeError` | `null` from `maxSatisfying()` |
| `VersionNotFoundError` | No equivalent |
| `EmptyCacheError` | No equivalent |
| `UnsatisfiableConstraintError` | No equivalent |
| `InvalidBumpError` | `null` from `inc()` |
| `VersionFetchError` | No equivalent |

### Parse Error Positions

semver-effect parse errors include a `position` field (zero-based character
offset) indicating where the parser failed. node-semver provides no position
information in its error messages. This is documented in node-semver issues
\#802, #191, #418 as a pain point.

---

## Data Model Divergences

### Immutable vs Mutable

node-semver's `SemVer` class is mutable. `inc()` mutates the instance in
place. Users must clone before bumping (node-semver issue #378).

semver-effect's `SemVer` is an immutable `Schema.TaggedClass`. All bump
operations return new instances.

### Structural Equality vs instanceof

node-semver uses `instanceof SemVer` for type checking, which breaks across
package versions (node-semver issue #354).

semver-effect uses Effect's `Equal` trait for structural equality. No
`instanceof` checks anywhere in the API.

### Build Metadata Preservation

node-semver strips build metadata from the `version` property:

```javascript
new SemVer("1.0.0-rc.27+test").version // "1.0.0-rc.27" (stripped!)
```

semver-effect preserves build metadata:

```typescript
parse("1.0.0-rc.27+test").toString() // "1.0.0-rc.27+test" (preserved)
```

Build metadata is excluded from `Equal` and `Hash` per the spec, but it is
stored and round-trips correctly.

### Tagged Types

Every semver-effect data type has a `_tag` discriminator:

- `SemVer._tag === "SemVer"`
- `Comparator._tag === "Comparator"`
- `Range._tag === "Range"`
- `VersionDiff._tag === "VersionDiff"`

This enables `Match.exhaustive` pattern matching. node-semver has no
equivalent.

---

## Operations Divergences

### Comparison Functions

| node-semver | semver-effect | Difference |
| :--- | :--- | :--- |
| `semver.gt(a, b)` | `gt(a, b)` | Takes SemVer only, not strings |
| `semver.compare(a, b)` | `compare(a, b)` | Returns `-1 \| 0 \| 1` (same) |
| `semver.sort(arr)` | `sort(arr)` | Returns new array, does not mutate |
| `semver.rsort(arr)` | `rsort(arr)` | Returns new array, does not mutate |

node-semver's `compare` creates new SemVer objects even when inputs are
already SemVer instances (node-semver issue #458). semver-effect's `compare`
works directly on SemVer fields with no allocations.

### Collection Operations

| node-semver | semver-effect | Difference |
| :--- | :--- | :--- |
| `semver.maxSatisfying(vs, r)` | `maxSatisfying(vs, r)` | Returns `Option<SemVer>` not `string \| null` |
| `semver.minSatisfying(vs, r)` | `minSatisfying(vs, r)` | Returns `Option<SemVer>` not `string \| null` |
| (no equivalent) | `max(vs)` | Returns `Option<SemVer>` |
| (no equivalent) | `min(vs)` | Returns `Option<SemVer>` |

### Bump Operations

| node-semver | semver-effect | Difference |
| :--- | :--- | :--- |
| `semver.inc(v, "major")` | `bumpMajor(v)` | Standalone function, returns new SemVer |
| `semver.inc(v, "minor")` | `bumpMinor(v)` | Standalone function, returns new SemVer |
| `semver.inc(v, "patch")` | `bumpPatch(v)` | Standalone function, returns new SemVer |
| `semver.inc(v, "prerelease", id)` | `bumpPrerelease(v, id?)` | Separate function with optional id |
| (no equivalent) | `bumpRelease(v)` | Strips prerelease and build |

node-semver's `inc()` mutates the SemVer instance and also returns the
string representation. semver-effect's bump functions always return new
`SemVer` instances.

node-semver supports `premajor`, `preminor`, `prepatch` increment types.
semver-effect does not currently provide these compound operations.

### Range Algebra

node-semver provides `semver.subset(a, b)` and `Range.intersects()`.
semver-effect provides a fuller algebra:

| Function | node-semver | semver-effect |
| :--- | :--- | :--- |
| `union(a, b)` | No | Yes (pure) |
| `intersect(a, b)` | `Range.intersects()` (boolean only) | Yes (returns Range or fails) |
| `simplify(r)` | No | Yes (pure) |
| `isSubset(a, b)` | `subset(a, b)` | Yes (pure) |
| `equivalent(a, b)` | No | Yes (pure) |

node-semver's `subset()` has known bugs with prerelease ranges (issues
\#757, #703).

### Truncate

semver-effect provides `truncate(v, level)` which strips metadata:

- `truncate(v, "prerelease")` -- removes prerelease and build
- `truncate(v, "build")` -- removes build only

node-semver has no direct equivalent (node-semver issue #48).

### Pretty Printing

semver-effect provides `prettyPrint(value)` using `Match.exhaustive` to
format any `SemVer | Comparator | Range | VersionDiff`. node-semver relies
on `toString()` methods only.

### Structured Diffing

semver-effect provides `diff(a, b)` returning a `VersionDiff` with:

- `type`: `"major" | "minor" | "patch" | "prerelease" | "build" | "none"`
- Signed integer deltas for each component
- References to both input versions

node-semver provides `semver.diff(a, b)` returning only the type string.

---

## Features Not Ported

The following node-semver features are intentionally not implemented:

| Feature | Reason |
| :--- | :--- |
| Loose parsing mode | Strict SemVer 2.0.0 only |
| `coerce()` | No coercion; inputs must be valid |
| `clean()` | No cleaning; inputs must be valid |
| `valid()` returning string | Use `parseVersion` returning Effect |
| `validRange()` returning string | Use `parseRange` returning Effect |
| `includePrerelease` option | Strict same-tuple policy always enforced |
| `premajor`/`preminor`/`prepatch` compound bumps | Use `bumpPrerelease` after bumping |
| `outside(v, range, hilo)` | Use comparison with resolve/filter |
| `gtr(v, range)` / `ltr(v, range)` | Use comparison operations |
| CLI tool | Library only |
| `Range.intersects()` | Use `intersect()` which returns the actual range |
| Regex export | Recursive descent parser, no regex |

---

## Features Added

Features in semver-effect with no node-semver equivalent:

| Feature | Description |
| :--- | :--- |
| Typed error channel | 10 error classes vs null returns |
| Parse error positions | Zero-based character offset |
| `VersionCache` service | Sorted set with query, resolution, grouping, navigation |
| `VersionFetcher` interface | Abstract service for external version sources |
| `VersionDiff` structured diff | Type + signed deltas vs type string only |
| Range algebra (`union`, `simplify`, `equivalent`) | Full algebraic operations |
| `SemVerOrderWithBuild` | Optional build metadata ordering |
| `truncate(v, level)` | Strip prerelease/build metadata |
| `prettyPrint` via Match.exhaustive | Type-safe formatting for all data types |
| `isPrerelease(v)` / `isStable(v)` | Predicate functions |
| `compareWithBuild(a, b)` | Build-aware comparison |
| Effect service pattern | DI, testability, composability |
| Dual calling convention | Data-first and data-last on all binary ops |
| Immutable data types | Schema.TaggedClass with Equal/Hash/Inspectable |

---

## node-semver Bug Fixes

semver-effect avoids known node-semver bugs:

| node-semver Issue | Bug | semver-effect |
| :--- | :--- | :--- |
| #458 | `compare()` allocates new SemVer objects | Direct field comparison, no allocations |
| #354 | `instanceof` breaks across package versions | Structural `Equal` trait |
| #378 | `inc()` mutates, users need clone | Immutable; bump returns new instance |
| #264 | `valid()` strips build metadata | Build metadata preserved |
| #757 | `subset()` wrong for prerelease ranges | Corrected `isSubset` implementation |
| #703 | `subset()` wrong for OR ranges | Corrected `isSubset` implementation |
| #521 | `intersects()` wrong for `< 0.0.0` | Correct satisfiability checking |
| #511 | `1.x.5` silently treated as `1.x.x` | Strict parsing rejects invalid partials |
| #691 | Accepts `v=1.2.3`, `vvv1.2.3`, etc. | Immediate rejection of any prefix |
| #483 | Wrong prerelease comparison | Correct numeric vs alphanumeric handling |
| #392 | BNF grammar doesn't match implementation | Grammar and parser are identical |

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture
- [parser.md](parser.md) -- Parser design (recursive descent vs regex)
- [operations.md](operations.md) -- Operations API comparison
- [error-model.md](error-model.md) -- Typed error hierarchy
- [semver-compliance.md](semver-compliance.md) -- SemVer 2.0.0 spec compliance
- [testing.md](testing.md) -- Test fixtures ported from node-semver

---

**Document Status:** Current -- documents all behavioral divergences between
semver-effect and node-semver, including parsing, API design, range behavior,
error handling, data model, and operations. Known node-semver bugs that are
fixed in semver-effect are cataloged.
