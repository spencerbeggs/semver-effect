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

- `src/schemas/SemVer.ts` -- SemVer type with custom Equal, Hash, Inspectable
- `src/schemas/Comparator.ts` -- Comparator type with operator and version
- `src/schemas/Range.ts` -- Range type containing ComparatorSets, plus
  ComparatorSet type alias
- `src/schemas/VersionDiff.ts` -- Structured diff between two versions
- `src/utils/order.ts` -- SemVerOrder and SemVerOrderWithBuild instances
- `src/index.ts` -- barrel file (only barrel in the project; no barrel files
  in subdirectories). All internal imports go directly to source files.

---

## Current State

All data model types are fully implemented and tested. The schemas, traits,
and serialization formats match the design spec.

### What Is Implemented

- All Schema.TaggedClass definitions (SemVer, Comparator, Range, VersionDiff)
- Custom Equal and Hash overrides on SemVer (excluding build metadata)
- Inspectable trait: toString, toJSON, nodejs.util.inspect.custom on SemVer
- toString and nodejs.util.inspect.custom on Comparator, Range, VersionDiff
- toJSON on VersionDiff
- SemVerOrder and SemVerOrderWithBuild as Order instances
- ComparatorSet type alias
- JSON serialization via Schema

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
const NonNegativeInt = Schema.Int.pipe(Schema.filter((n) => n >= 0));
const PrereleaseItem = Schema.Union(Schema.String, NonNegativeInt);

class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
  major: NonNegativeInt,
  minor: NonNegativeInt,
  patch: NonNegativeInt,
  prerelease: Schema.Array(PrereleaseItem),
  build: Schema.Array(Schema.String),
}) {
  [Equal.symbol](that: Equal.Equal): boolean { /* ... */ }
  [Hash.symbol](): number { /* ... */ }
  toString(): string { /* ... */ }
  toJSON(): unknown { /* ... */ }
  [Symbol.for("nodejs.util.inspect.custom")](): string { /* ... */ }
}
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

Numeric identifiers in version components and prerelease tags are validated
with `Number.isSafeInteger()` in the parser to reject values beyond 2^53-1.
The parser produces a clear error when an identifier exceeds the safe integer
range rather than silently truncating.

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
  so `1.0.0+001` and `1.0.0+0042` are valid.

#### Trait: Equal

Custom implementation overriding `[Equal.symbol]`. Compares `major`, `minor`,
`patch`, and `prerelease` element-by-element. Build metadata is **excluded**
per SemVer 2.0.0 spec clause 11.

```typescript
[Equal.symbol](that: Equal.Equal): boolean {
  if (!(that instanceof SemVer)) return false;
  return (
    this.major === that.major &&
    this.minor === that.minor &&
    this.patch === that.patch &&
    this.prerelease.length === that.prerelease.length &&
    this.prerelease.every((v, i) => v === that.prerelease[i])
  );
}
```

**Why the override is mandatory:** The default `Data.Class` equality performs
shallow reference comparison on arrays, which means two SemVer instances with
identical prerelease elements but different array references would not be
equal. Additionally, the default hash includes all fields, so build metadata
would affect hash values.

#### Trait: Hash

Custom implementation overriding `[Hash.symbol]`. Hashes `major`, `minor`,
`patch`, and each element of `prerelease`. Build metadata is excluded,
ensuring versions differing only in build metadata produce the same hash.

```typescript
[Hash.symbol](): number {
  let h = Hash.hash(this.major);
  h = Hash.combine(h)(Hash.hash(this.minor));
  h = Hash.combine(h)(Hash.hash(this.patch));
  for (const item of this.prerelease) {
    h = Hash.combine(h)(Hash.hash(item));
  }
  return Hash.cached(this)(h);
}
```

#### Trait: Order

SemVer 2.0.0 spec clause 11 defines precedence. Implemented in
`src/utils/order.ts` as `SemVerOrder`:

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

**`SemVerOrderWithBuild`** -- An alternative `Order<SemVer>` instance that
extends the standard comparison to include build metadata. When the standard
comparison returns 0, it performs a lexicographic comparison of build metadata
arrays. A version with no build metadata sorts before a version with build
metadata when all other fields are equal.

#### Trait: Inspectable

SemVer implements three Inspectable methods:

- **`toString()`**: Returns the spec-compliant version string (e.g.,
  `"1.0.0-alpha.1+build.001"`).
- **`toJSON()`**: Returns the tagged JSON object with `_tag`, `major`, `minor`,
  `patch`, `prerelease`, `build`.
- **`[Symbol.for("nodejs.util.inspect.custom")]()`**: Returns the same string
  as `toString()` for clean Node.js console output.

#### Construction: `disableValidation` for Parser Internals

When constructing SemVer instances inside the parser (where input has already
been validated by the grammar), `{ disableValidation: true }` is passed as the
second argument to skip redundant schema validation. This is used in the
parser, bump operations, desugar, and normalize modules.

---

### Comparator

**File:** `src/schemas/Comparator.ts`
**Tag:** `"Comparator"`

```typescript
class Comparator extends Schema.TaggedClass<Comparator>()("Comparator", {
  operator: Schema.Literal("=", ">", ">=", "<", "<="),
  version: SemVer,
}) {
  toString(): string {
    const op = this.operator === "=" ? "" : this.operator;
    return `${op}${this.version.toString()}`;
  }
}
```

#### Fields

| Field | Type | Values |
| :------- | :------- | :------------------------------ |
| operator | `string` | `"="`, `">"`, `">="`, `"<"`, `"<="` |
| version | `SemVer` | Any valid SemVer instance |

#### Semantics

A Comparator tests whether a candidate version satisfies a single constraint.
The `=` operator is the default when no operator is specified in a range string.
Comparators are the atomic unit of range matching; all range syntactic sugar
desugars to Comparators.

#### toString

The `=` operator is omitted in string output (e.g., `=1.2.3` renders as
`1.2.3`). All other operators are prefixed (e.g., `>=1.0.0`).

---

### ComparatorSet

**File:** `src/schemas/Range.ts` (co-located with Range)
**No tag** -- type alias only

```typescript
type ComparatorSet = ReadonlyArray<Comparator>
```

A ComparatorSet represents the logical AND of its Comparators. A version
satisfies a ComparatorSet only if it satisfies **every** Comparator in
the set. An empty ComparatorSet `[]` matches all versions (vacuous truth).

---

### Range

**File:** `src/schemas/Range.ts`
**Tag:** `"Range"`

```typescript
class Range extends Schema.TaggedClass<Range>()("Range", {
  sets: Schema.Array(Schema.Array(Comparator)),
}) {
  toString(): string {
    return this.sets.map((set) => set.map((c) => c.toString()).join(" ")).join(" || ");
  }
}
```

#### Semantics

A Range represents the logical OR of its ComparatorSets. A version satisfies
a Range if it satisfies **at least one** ComparatorSet.

#### toString

Produces the desugared, normalized form. ComparatorSets are space-separated,
sets are joined with ` || `.

---

### VersionDiff

**File:** `src/schemas/VersionDiff.ts`
**Tag:** `"VersionDiff"`

```typescript
class VersionDiff extends Schema.TaggedClass<VersionDiff>()("VersionDiff", {
  type: Schema.Literal("major", "minor", "patch", "prerelease", "build", "none"),
  from: SemVer,
  to: SemVer,
  major: Schema.Int,
  minor: Schema.Int,
  patch: Schema.Int,
}) {
  toString(): string {
    return `${this.type} (${this.from.toString()} → ${this.to.toString()})`;
  }
  toJSON(): unknown { /* tagged JSON with nested SemVer JSON */ }
}
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

The `type` field indicates the most significant component that differs.
Precedence: major > minor > patch > prerelease > build > none. Delta fields
are signed (can be negative if `to` is lower than `from`).

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
```

### Dependency Graph

```text
SemVer  <----  Comparator  <----  ComparatorSet  <----  Range
   |
   +---------> VersionDiff (references two SemVer instances)
```

### Module Import Order

1. `src/schemas/SemVer.ts` -- no data model imports
2. `src/utils/order.ts` -- imports SemVer
3. `src/schemas/Comparator.ts` -- imports SemVer
4. `src/schemas/Range.ts` -- imports Comparator (and ComparatorSet alias)
5. `src/schemas/VersionDiff.ts` -- imports SemVer
6. `src/index.ts` -- re-exports all public types

### Type Discrimination

| Type | `_tag` Value |
| :---------- | :-------------- |
| SemVer | `"SemVer"` |
| Comparator | `"Comparator"` |
| Range | `"Range"` |
| VersionDiff | `"VersionDiff"` |

Used with Effect.Match for type-safe pattern matching (see prettyPrint.ts).

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
  "version": { "_tag": "SemVer", "major": 1, "minor": 0, "patch": 0, "prerelease": [], "build": [] }
}
```

### Range JSON

```json
{
  "_tag": "Range",
  "sets": [[
    { "_tag": "Comparator", "operator": ">=", "version": { "_tag": "SemVer", ... } },
    { "_tag": "Comparator", "operator": "<", "version": { "_tag": "SemVer", ... } }
  ]]
}
```

### VersionDiff JSON

```json
{
  "_tag": "VersionDiff",
  "type": "minor",
  "from": { "_tag": "SemVer", ... },
  "to": { "_tag": "SemVer", ... },
  "major": 0,
  "minor": 3,
  "patch": -3
}
```

### String Serialization

- `SemVer` -> `"1.2.3-alpha.1+build.001"`
- `Comparator` -> `">=1.0.0"` (operator + version string; `=` omitted)
- `ComparatorSet` -> `">=1.0.0 <2.0.0"` (space-separated)
- `Range` -> `">=1.0.0 <2.0.0 || >=3.0.0"` (` || `-separated sets)
- `VersionDiff` -> `"minor (1.2.3 -> 1.5.0)"` (type + direction)

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture and component overview
- [error-model.md](error-model.md) -- Error type definitions and handling patterns
- [parser.md](parser.md) -- Parser implementation details and grammar rules

---

**Document Status:** Current -- reflects the complete implemented data model.
All schemas, traits, and serialization are implemented and tested.
