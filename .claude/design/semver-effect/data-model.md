---
status: draft
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 80
related:
  - architecture.md
  - error-model.md
  - parser.md
dependencies: []
---

# Semver Effect - Core Data Model

Defines the immutable data types that form the foundation of semver-effect:
SemVer, Comparator, ComparatorSet, Range, and VersionDiff. All types are
Schema.TaggedClass instances with Effect trait implementations.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Schema Definitions](#schema-definitions)
   - [SemVer](#semver)
   - [Comparator](#comparator)
   - [ComparatorSet](#comparatorset)
   - [Range](#range)
   - [VersionDiff](#versiondiff)
5. [Type Relationships](#type-relationships)
6. [Serialization](#serialization)
7. [Related Documentation](#related-documentation)

---

## Overview

The core data model provides the immutable, typed representations of SemVer
2.0.0 concepts. Every type is a Schema.TaggedClass, giving it automatic
`_tag` discrimination, JSON serialization, and structural equality. The
data model is the lowest layer of the package -- the parser produces these
types, the VersionCache stores them, and all operations consume them.

**Design constraints:**

- All fields are readonly; mutation returns a new instance
- Build metadata is stored but excluded from equality and ordering per spec
- Prerelease identifiers preserve their original type (string vs number)
- No optional fields on core types; prerelease and build default to `[]`
- Every type carries a `_tag` field for pattern matching and serialization

**Source files:**

- `src/schemas/SemVer.ts` -- SemVer type, bump operations, comparison helpers
- `src/schemas/Comparator.ts` -- Comparator type with operator and version
- `src/schemas/Range.ts` -- Range type containing ComparatorSets
- `src/schemas/VersionDiff.ts` -- Structured diff between two versions
- `src/order.ts` -- Order instance for SemVer
- `src/index.ts` -- barrel file (only barrel in the project; no barrel files
  in subdirectories). All internal imports go directly to source files.

---

## Current State

The project is in early implementation. The design spec is approved and the
data model is fully specified, but source modules have not yet been written.
This document serves as the implementation reference for all core types.

### What Exists

- Approved design spec with complete type definitions
- Package scaffolding with build pipeline
- Architecture design doc describing component relationships

### What Needs Implementation

- All Schema.TaggedClass definitions for SemVer, Comparator, Range, VersionDiff
- Equal, Order, Hash, and Inspectable trait implementations for SemVer
- Static bump methods on SemVer
- ComparatorSet type alias
- JSON serialization schemas

---

## Rationale

### Why Schema.TaggedClass

Schema.TaggedClass provides several features that align with the goals of
this package:

1. **Discriminated unions via `_tag`:** Every instance carries a `_tag`
   string literal, enabling `Effect.Match` and `switch` discrimination
   across types (SemVer vs Comparator vs Range).

2. **Built-in Schema:** Each class is its own Schema, so encoding/decoding
   to JSON or other formats requires zero additional code.

3. **Structural equality by default:** Schema.TaggedClass instances compare
   by value, not by reference. This is critical for SemVer where
   `1.0.0+build1` must equal `1.0.0+build2`.

4. **Immutability:** Instances are frozen. Bump operations return new
   instances rather than mutating.

5. **Hash derivation:** Hash is derived from Equal, so SemVer instances
   work correctly in HashSet and HashMap without custom hash functions.

### Why Prerelease Is `ReadonlyArray<string | number>`

SemVer 2.0.0 spec clause 11.4 states that numeric identifiers are compared
as integers and alphanumeric identifiers are compared as strings. Preserving
the original type in the array avoids reparsing during comparison and keeps
ordering correct:

- `1.0.0-alpha.1` has prerelease `["alpha", 1]`
- `1.0.0-alpha.2` has prerelease `["alpha", 2]`
- Numeric comparison: `1 < 2` (correct)
- If stored as strings: `"1" < "2"` happens to work, but `"9" > "10"`
  would not

### Why Build Is `ReadonlyArray<string>` (Not `string | number`)

Build metadata identifiers have no ordering semantics in the spec. They are
opaque dot-separated strings. There is no benefit to parsing numeric build
identifiers as numbers because they are never compared.

### Why Separate ComparatorSet Type Alias

ComparatorSet is a `ReadonlyArray<Comparator>` rather than its own
TaggedClass because:

- It has no additional fields beyond the array
- It has no custom traits (equality is element-wise Comparator equality)
- A type alias keeps the model minimal
- Range already wraps `ReadonlyArray<ComparatorSet>`, providing the
  tagged wrapper

---

## Schema Definitions

### SemVer

**File:** `src/schemas/SemVer.ts`
**Tag:** `"SemVer"`

```typescript
class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
  major: Schema.Int.pipe(Schema.filter((n) => n >= 0)),
  minor: Schema.Int.pipe(Schema.filter((n) => n >= 0)),
  patch: Schema.Int.pipe(Schema.filter((n) => n >= 0)),
  prerelease: Schema.Array(Schema.Union(Schema.String, Schema.Int.pipe(Schema.filter((n) => n >= 0)))),
  build: Schema.Array(Schema.String),
}) {}
```

**Why `Schema.Int.pipe(Schema.filter(...))` instead of `Schema.NonNegativeInt`:**
`Schema.NonNegativeInt` applies a Brand (`NonNegativeInt & Brand<"NonNegativeInt">`)
that leaks into the consumer API, requiring callers to brand their numbers before
constructing a SemVer. Using `Schema.Int.pipe(Schema.filter((n) => n >= 0))`
validates at construction time but keeps the external type as plain `number`,
which is the ergonomic choice for a public API.

#### Fields

| Field | Type | Constraint | Default |
| :---------- | :------------------------------------ | :----------------- | :------ |
| major | `number` | Non-negative int | -- |
| minor | `number` | Non-negative int | -- |
| patch | `number` | Non-negative int | -- |
| prerelease | `ReadonlyArray<string \| number>` | See spec clause 9 | `[]` |
| build | `ReadonlyArray<string>` | See spec clause 10 | `[]` |

#### Integer Overflow

Numeric identifiers in version components and prerelease tags should be
validated with `Number.isSafeInteger()` to reject values beyond 2^53-1. The
parser and schema filter should produce a clear error when an identifier
exceeds the safe integer range rather than silently truncating.

#### Prerelease Identifier Rules (Spec Clause 9)

- Dot-separated identifiers comprising ASCII alphanumerics and hyphens
- Numeric identifiers must not have leading zeros
- Numeric identifiers are compared as integers
- Alphanumeric identifiers are compared lexically as ASCII strings
- Numeric identifiers always have lower precedence than alphanumeric
- A version with prerelease has lower precedence than the same version
  without prerelease

#### Build Metadata Rules (Spec Clause 10)

- Dot-separated identifiers comprising ASCII alphanumerics and hyphens
- Build metadata is ignored when determining version precedence
- Two versions differing only in build metadata are equal
- Leading zeros ARE allowed in build metadata identifiers. The SemVer BNF
  grammar uses `<digits>` (not `<numeric identifier>`) for build identifiers,
  so `1.0.0+001` and `1.0.0+0042` are valid. This is different from prerelease,
  where leading zeros in numeric identifiers are forbidden.

#### Trait: Equal

Structural equality comparing `major`, `minor`, `patch`, and `prerelease`.
Build metadata is **excluded** per SemVer 2.0.0 spec clause 11:

```typescript
// These are equal:
// SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: ["001"] })
// SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: ["exp"] })

// Prerelease comparison is element-wise:
// ["alpha", 1] === ["alpha", 1]  -> true
// ["alpha", 1] === ["alpha", 2]  -> false
```

Implementation approach: override `[Equal.symbol]` to compare the four
fields (major, minor, patch, prerelease) while ignoring build. Prerelease
arrays are compared element-by-element with strict type matching (number
=== number, string === string).

##### Equal/Hash Override Is Mandatory

The default `Data.Class` equality performs shallow reference comparison on
arrays, which means two SemVer instances with identical prerelease elements
but different array references would not be equal. Additionally, the default
hash includes all fields, so build metadata would affect hash values. Both
of these are incorrect for SemVer semantics.

We MUST override `[Equal.symbol]` and `[Hash.symbol]` on SemVer:

- **Equal** must exclude build metadata (per SemVer 2.0.0 spec) and compare
  prerelease arrays element-wise
- **Hash** must be consistent with Equal (exclude build from hash computation)

```typescript
[Equal.symbol](that: Equal.Equal): boolean {
  if (!(that instanceof SemVer)) return false
  return (
    this.major === that.major &&
    this.minor === that.minor &&
    this.patch === that.patch &&
    this.prerelease.length === that.prerelease.length &&
    this.prerelease.every((v, i) => v === that.prerelease[i])
  )
}
```

The `[Hash.symbol]` implementation must hash only `major`, `minor`, `patch`,
and each element of `prerelease` (not `build`), ensuring that versions
differing only in build metadata produce the same hash.

#### Trait: Order

SemVer 2.0.0 spec clause 11 defines precedence:

1. Compare `major` as integers. If different, done.
2. Compare `minor` as integers. If different, done.
3. Compare `patch` as integers. If different, done.
4. A version with no prerelease has **higher** precedence than one with
   prerelease (i.e., `1.0.0 > 1.0.0-alpha`).
5. Compare prerelease identifiers left to right:
   a. Numeric identifiers are compared as integers.
   b. Alphanumeric identifiers are compared as ASCII strings.
   c. Numeric identifiers always have lower precedence than alphanumeric.
   d. A shorter prerelease array has lower precedence if all preceding
      identifiers are equal (i.e., `1.0.0-alpha < 1.0.0-alpha.1`).

Build metadata does **not** affect ordering.

Implementation approach: define an `Order<SemVer>` instance in
`src/order.ts` that encodes these rules. The Order is also used by
SortedSet in the VersionCache service.

**`SemVerOrderWithBuild`** -- An alternative `Order<SemVer>` instance
(also exported from `src/order.ts`) that extends the standard comparison
to include build metadata. When the standard SemVer comparison returns 0
(versions are equal ignoring build), this Order additionally compares
build metadata identifiers lexicographically, left to right. Useful for
CI pipelines and other contexts where deterministic ordering of
build-metadata-only differences is required. If one version has build
metadata and the other does not, the version with build metadata is
considered greater (analogous to how prerelease presence lowers
precedence, build presence raises it in this extended ordering).

```typescript
// Ordering examples:
// 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta
//   < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
```

#### Trait: Hash

Derived from Equal. The hash function must produce the same hash for
versions that are equal under the Equal trait (i.e., versions differing
only in build metadata must have the same hash).

Implementation approach: hash `major`, `minor`, `patch`, and each element
of `prerelease`. Do not include `build` in the hash.

##### SortedSet Deduplication Note

Because Equal ignores build metadata, a SortedSet (or HashSet) will treat
`1.0.0+build1` and `1.0.0+build2` as the same element. This is CORRECT
behavior for our use case -- the SemVer spec says versions differing only in
build metadata have the same precedence. When inserting duplicates that differ
only in build metadata, "first in wins" is the expected behavior. The
VersionCache service relies on this deduplication property.

#### Trait: Inspectable

Formats the version as a spec-compliant string:

```text
{major}.{minor}.{patch}[-{prerelease joined with "."}][+{build joined with "."}]
```

Examples:

- `SemVer(1, 2, 3, [], [])` -> `"1.2.3"`
- `SemVer(1, 0, 0, ["alpha", 1], [])` -> `"1.0.0-alpha.1"`
- `SemVer(1, 0, 0, ["rc", 1], ["build", "001"])` -> `"1.0.0-rc.1+build.001"`

##### Inspectable Method Implementations

SemVer implements the three Inspectable methods:

- **`toString()`**: Returns the spec-compliant version string (e.g.,
  `"1.0.0-alpha.1+build.001"`). This is the canonical string representation
  used throughout the API.
- **`toJSON()`**: Returns the tagged JSON object (the Schema-encoded form with
  `_tag`, `major`, `minor`, `patch`, `prerelease`, `build`). This is used by
  `JSON.stringify()` and Effect's serialization.
- **`[Symbol.for("nodejs.util.inspect.custom")]()`**: Returns the same string
  as `toString()` so that `console.log(semver)` and `util.inspect()` in
  Node.js produce the human-readable version string rather than the raw
  object internals.

#### Construction: `disableValidation` for Parser Internals

When constructing SemVer instances inside the parser (where input has already
been validated by the grammar), pass `{ disableValidation: true }` as the
second argument to the constructor to skip redundant schema validation. This
avoids running the filter pipeline a second time for values that are known
valid, improving parser throughput:

```typescript
new SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: [] }, { disableValidation: true })
```

This option should only be used in trusted internal code paths (parser,
bump operations) -- never in public-facing construction APIs where input
validation is needed.

#### Static Methods: SemVer.bump

All bump operations return a new SemVer instance. They do not mutate.
Bump methods use `new SemVer({...}, { disableValidation: true })` internally
since the bumped values are guaranteed valid by construction.

**`SemVer.bump.major(v: SemVer): SemVer`**

- Increments `major` by 1
- Resets `minor` and `patch` to 0
- Clears `prerelease` and `build`
- Example: `1.2.3-alpha+build` -> `2.0.0`

**`SemVer.bump.minor(v: SemVer): SemVer`**

- Increments `minor` by 1
- Resets `patch` to 0
- Clears `prerelease` and `build`
- Example: `1.2.3-alpha` -> `1.3.0`

**`SemVer.bump.patch(v: SemVer): SemVer`**

- Increments `patch` by 1
- Clears `prerelease` and `build`
- Example: `1.2.3-alpha` -> `1.2.4`

**`SemVer.bump.prerelease(v: SemVer, id?: string): SemVer`**

- If `v` has no prerelease: appends `[id ?? "0", 0]` to current version
- If `v` has prerelease ending in a number: increments that number
- If `v` has prerelease ending in a string: appends `0`
- If `id` is provided and differs from current prerelease prefix: resets
  to `[id, 0]`
- Clears `build`
- Examples:
  - `1.0.0` with no id -> `1.0.1-0`
  - `1.0.0-alpha.1` with no id -> `1.0.0-alpha.2`
  - `1.0.0-alpha.1` with id `"beta"` -> `1.0.0-beta.0`

**`SemVer.bump.release(v: SemVer): SemVer`**

- Removes prerelease and build metadata
- Version numbers unchanged
- Example: `1.2.3-alpha.1+build` -> `1.2.3`
- If already a release version, returns an equivalent copy

**`SemVer.truncate(part: "prerelease" | "build", v: SemVer): SemVer`**

A pure function that strips prerelease and/or build metadata from a version.
Uses `dual` for data-first/data-last calling convention. Returns a new SemVer
instance (immutable, like all operations).

- `SemVer.truncate("prerelease", v)` -- returns a new SemVer with
  `prerelease: []` and `build: []` (stripping prerelease implicitly strips
  build as well)
- `SemVer.truncate("build", v)` -- returns a new SemVer with `build: []`
  (keeps prerelease intact)
- Examples:
  - `SemVer.truncate("prerelease", 1.0.0-alpha.1+build)` -> `1.0.0`
  - `SemVer.truncate("build", 1.0.0-alpha.1+build)` -> `1.0.0-alpha.1`
  - `SemVer.truncate("build", 1.0.0)` -> `1.0.0` (no-op)
- Data-last usage: `pipe(v, SemVer.truncate("build"))`

---

### Comparator

**File:** `src/schemas/Comparator.ts`
**Tag:** `"Comparator"`

```typescript
class Comparator extends Schema.TaggedClass<Comparator>()("Comparator", {
  operator: Schema.Literal("=", ">", ">=", "<", "<="),
  version: SemVer,
}) {}
```

#### Fields

| Field | Type | Values |
| :------- | :------- | :------------------------------ |
| operator | `string` | `"="`, `">"`, `">="`, `"<"`, `"<="` |
| version | `SemVer` | Any valid SemVer instance |

#### Semantics

A Comparator tests whether a candidate version satisfies a single
constraint:

- `=1.2.3` -- candidate must equal 1.2.3
- `>1.2.3` -- candidate must be greater than 1.2.3
- `>=1.2.3` -- candidate must be greater than or equal to 1.2.3
- `<1.2.3` -- candidate must be less than 1.2.3
- `<=1.2.3` -- candidate must be less than or equal to 1.2.3

Comparison uses the SemVer Order instance, so prerelease ordering is
handled correctly and build metadata is ignored.

#### Notes

- The `=` operator is the default when no operator is specified in a range
  string (e.g., `1.2.3` means `=1.2.3`)
- Comparators are the atomic unit of range matching; all range syntactic
  sugar desugars to Comparators
- Two Comparators are equal if both operator and version are equal

---

### ComparatorSet

**File:** `src/schemas/Range.ts` (co-located with Range)
**No tag** -- type alias only

```typescript
type ComparatorSet = ReadonlyArray<Comparator>
```

#### Semantics

A ComparatorSet represents the logical AND of its Comparators. A version
satisfies a ComparatorSet only if it satisfies **every** Comparator in
the set.

```text
// ComparatorSet: [>=1.2.3, <2.0.0]
// Matches: 1.2.3, 1.5.0, 1.99.99
// Does not match: 1.2.2, 2.0.0, 3.0.0
```

#### Empty Set

An empty ComparatorSet `[]` matches all versions (vacuous truth -- there
are no constraints to violate).

#### Typical Compositions

Range syntactic sugar desugars to ComparatorSets of one or two Comparators:

| Sugar | Desugared ComparatorSet |
| :-------------- | :----------------------------------- |
| `^1.2.3` | `[>=1.2.3, <2.0.0-0]` |
| `~1.2.3` | `[>=1.2.3, <1.3.0-0]` |
| `1.2.x` | `[>=1.2.0, <1.3.0-0]` |
| `1.x` | `[>=1.0.0, <2.0.0-0]` |
| `*` | `[]` (empty -- matches all) |
| `1.2.3 - 2.0.0` | `[>=1.2.3, <=2.0.0]` |
| `>=1.0.0` | `[>=1.0.0]` (single comparator) |
| `1.2.3` | `[=1.2.3]` (single comparator) |

Note: the upper bound uses a `-0` prerelease suffix (e.g., `<2.0.0-0`)
to exclude prereleases of the next version while including all prereleases
of the current range. This follows the node-semver convention.

---

### Range

**File:** `src/schemas/Range.ts`
**Tag:** `"Range"`

```typescript
class Range extends Schema.TaggedClass<Range>()("Range", {
  sets: Schema.Array(Schema.Array(Comparator)),
}) {}
```

#### Fields

| Field | Type | Constraint |
| :---- | :------------------------------- | :------------- |
| sets | `ReadonlyArray<ComparatorSet>` | At least one set |

#### Semantics

A Range represents the logical OR of its ComparatorSets. A version
satisfies a Range if it satisfies **at least one** ComparatorSet.

```text
// Range with sets: [[>=1.0.0, <2.0.0], [>=3.0.0, <4.0.0]]
// Equivalent to: (>=1.0.0 AND <2.0.0) OR (>=3.0.0 AND <4.0.0)
// Matches: 1.0.0, 1.5.0, 3.0.0, 3.9.9
// Does not match: 0.9.9, 2.0.0, 2.5.0, 4.0.0
```

#### Parsing and Desugaring

The parser converts range strings to Range instances by:

1. Splitting on `||` to get OR-separated groups
2. Parsing each group into a ComparatorSet
3. Desugaring syntactic sugar (caret, tilde, x-range, hyphen) into
   primitive Comparators
4. Wrapping all ComparatorSets in a Range

Examples:

| Input | Parsed Range (sets) |
| :----------------------- | :----------------------------------------------- |
| `>=1.0.0 <2.0.0` | `[[>=1.0.0, <2.0.0]]` |
| `^1.2.3` | `[[>=1.2.3, <2.0.0-0]]` |
| `~1.2 \|\| >=3.0.0` | `[[>=1.2.0, <1.3.0-0], [>=3.0.0]]` |
| `1.2.3 - 2.0.0 \|\| ^3` | `[[>=1.2.3, <=2.0.0], [>=3.0.0, <4.0.0-0]]` |
| `*` | `[[]]` (single empty set -- matches all) |

#### Range Algebra Operations (Future)

These operations are planned for Phase 2:

- `Range.intersect(a, b)` -- AND of two ranges (may be unsatisfiable)
- `Range.union(a, b)` -- OR of two ranges
- `Range.simplify(range)` -- reduce redundant comparator sets
- `Range.isSubset(sub, sup)` -- true if sub is a subset of sup
- `Range.equivalent(a, b)` -- true if ranges match identical version sets

---

### VersionDiff

**File:** `src/schemas/VersionDiff.ts`
**Tag:** `"VersionDiff"`

```typescript
class VersionDiff extends Schema.TaggedClass<VersionDiff>()("VersionDiff", {
  type: Schema.Literal(
    "major", "minor", "patch", "prerelease", "build", "none"
  ),
  from: SemVer,
  to: SemVer,
  major: Schema.Int,
  minor: Schema.Int,
  patch: Schema.Int,
}) {}
```

#### Fields

| Field | Type | Description |
| :---- | :------- | :--------------------------------------------- |
| type | `string` | Highest-precedence component that changed |
| from | `SemVer` | Starting version |
| to | `SemVer` | Ending version |
| major | `number` | Delta: `to.major - from.major` |
| minor | `number` | Delta: `to.minor - from.minor` |
| patch | `number` | Delta: `to.patch - from.patch` |

#### Type Field Semantics

The `type` field indicates the most significant component that differs
between `from` and `to`:

| type | Condition |
| :------------- | :----------------------------------------------------- |
| `"none"` | Versions are equal (ignoring build metadata) |
| `"build"` | Only build metadata differs |
| `"prerelease"` | major/minor/patch are same, prerelease differs |
| `"patch"` | major/minor are same, patch differs |
| `"minor"` | major is same, minor differs |
| `"major"` | major differs |

Precedence: major > minor > patch > prerelease > build > none. The type
is always the highest-precedence field that differs.

#### Delta Fields

The `major`, `minor`, and `patch` fields are signed integer deltas:

- `SemVer.diff(1.2.3, 2.0.0)` -> `{ type: "major", major: 1, minor: -2, patch: -3 }`
- `SemVer.diff(1.2.3, 1.2.3)` -> `{ type: "none", major: 0, minor: 0, patch: 0 }`
- `SemVer.diff(2.0.0, 1.5.0)` -> `{ type: "major", major: -1, minor: 5, patch: 0 }`

Negative deltas indicate the `to` version is lower than `from` in that
component.

#### Notes

- VersionDiff does not track prerelease or build deltas as structured
  fields because prerelease arrays can have different lengths and mixed
  types, making a single delta value meaningless
- The `type` field is sufficient to determine whether a prerelease or
  build change occurred
- VersionDiff is produced by `SemVer.diff(a, b)`, a pure function

---

## Type Relationships

### Composition Hierarchy

```text
Range
 |
 +-- sets: ReadonlyArray<ComparatorSet>
                           |
                           +-- ReadonlyArray<Comparator>
                                                |
                                                +-- operator: string
                                                +-- version: SemVer
                                                               |
                                                               +-- major
                                                               +-- minor
                                                               +-- patch
                                                               +-- prerelease
                                                               +-- build
```

### Dependency Graph

```text
SemVer  <----  Comparator  <----  ComparatorSet  <----  Range
   |
   +---------> VersionDiff (references two SemVer instances)
```

- SemVer is the leaf type with no dependencies on other data model types
- Comparator depends on SemVer
- ComparatorSet depends on Comparator (and transitively on SemVer)
- Range depends on ComparatorSet (and transitively on Comparator, SemVer)
- VersionDiff depends on SemVer only

### Module Import Order

Implementation should follow the dependency graph bottom-up:

1. `src/schemas/SemVer.ts` -- no data model imports
2. `src/order.ts` -- imports SemVer
3. `src/schemas/Comparator.ts` -- imports SemVer
4. `src/schemas/Range.ts` -- imports Comparator (and ComparatorSet alias)
5. `src/schemas/VersionDiff.ts` -- imports SemVer
6. `src/index.ts` -- re-exports all public types (only barrel file; no
   barrel files exist in subdirectories like `src/schemas/`)

### Type Discrimination

All TaggedClass types carry a `_tag` field for pattern matching:

| Type | `_tag` Value |
| :---------- | :-------------- |
| SemVer | `"SemVer"` |
| Comparator | `"Comparator"` |
| Range | `"Range"` |
| VersionDiff | `"VersionDiff"` |

This enables discrimination when handling mixed collections or union types:

```typescript
// Effect.Match usage
pipe(
  value,
  Match.tag("SemVer", (v) => /* handle version */),
  Match.tag("Range", (r) => /* handle range */),
  Match.exhaustive,
)
```

---

## Serialization

All data types serialize to JSON via their Schema definitions.

### SemVer JSON

```json
{
  "_tag": "SemVer",
  "major": 1,
  "minor": 2,
  "patch": 3,
  "prerelease": ["alpha", 1],
  "build": ["001"]
}
```

### Comparator JSON

```json
{
  "_tag": "Comparator",
  "operator": ">=",
  "version": {
    "_tag": "SemVer",
    "major": 1,
    "minor": 0,
    "patch": 0,
    "prerelease": [],
    "build": []
  }
}
```

### Range JSON

```json
{
  "_tag": "Range",
  "sets": [
    [
      {
        "_tag": "Comparator",
        "operator": ">=",
        "version": { "_tag": "SemVer", "major": 1, "minor": 0, "patch": 0, "prerelease": [], "build": [] }
      },
      {
        "_tag": "Comparator",
        "operator": "<",
        "version": { "_tag": "SemVer", "major": 2, "minor": 0, "patch": 0, "prerelease": ["0"], "build": [] }
      }
    ]
  ]
}
```

### VersionDiff JSON

```json
{
  "_tag": "VersionDiff",
  "type": "minor",
  "from": { "_tag": "SemVer", "major": 1, "minor": 2, "patch": 3, "prerelease": [], "build": [] },
  "to": { "_tag": "SemVer", "major": 1, "minor": 5, "patch": 0, "prerelease": [], "build": [] },
  "major": 0,
  "minor": 3,
  "patch": -3
}
```

### String Serialization

In addition to JSON, SemVer provides string serialization via Inspectable:

- `SemVer` -> `"1.2.3-alpha.1+build.001"`
- `Comparator` -> `">=1.0.0"` (operator + version string)
- `ComparatorSet` -> `">=1.0.0 <2.0.0"` (space-separated)
- `Range` -> `">=1.0.0 <2.0.0 || >=3.0.0"` (` || `-separated sets)
- `VersionDiff` -> no standard string form (use JSON)

String serialization is lossless for SemVer (the string can be parsed back
to an identical instance). For Range, string serialization produces the
desugared form, not the original input string.

---

## Related Documentation

**Architecture:**

- [architecture.md](architecture.md) -- System architecture, component
  relationships, and architectural decisions

**Design Spec:**

- [semver-effect Design Spec](../../../docs/specs/semver-effect-design.md) --
  Approved design specification with full API surface

**Planned (not yet created):**

- error-model.md -- Detailed error type definitions and error handling
  patterns
- parser.md -- Parser implementation details, grammar rules, and
  desugaring logic

---

**Document Status:** Draft -- covers all core data types with complete
field definitions, trait implementations, and serialization formats.
Completeness is 75% following research into Equal/Hash overrides, schema
typing decisions, disableValidation usage, and Inspectable details.
Remaining gap is that error-model.md and parser.md (listed as related) do
not yet exist, and implementation may reveal adjustments.

**Next Steps:** Implement `src/schemas/SemVer.ts` first, then
`src/schemas/Comparator.ts`, `src/schemas/Range.ts`, and
`src/schemas/VersionDiff.ts` following the dependency order in Type
Relationships.
Update this document as implementation reveals any changes to the schema
definitions.
