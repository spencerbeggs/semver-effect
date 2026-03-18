---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-17
last-synced: 2026-03-17
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
`_tag` discrimination and structural equality. The data model is the lowest
layer of the package -- the parser produces these types, the VersionCache
stores them, and all operations consume them.

**Design constraints:**

- All fields are readonly; mutation returns a new instance
- Build metadata is stored but excluded from equality and ordering per spec
- Prerelease identifiers preserve their original type (string vs number)
- No optional fields on core types; prerelease and build default to `[]`
- Every type carries a `_tag` field for pattern matching and serialization
- Schema classes provide instance methods (comparison, bumping, testing) and
  static methods (parsing, collection operations) as the primary API
- Standalone functions are the same operations available for pipe composition

**Source files:**

- `src/schemas/SemVer.ts` -- SemVer type with custom Equal, Hash, Inspectable
- `src/schemas/Comparator.ts` -- Comparator type with operator and version
- `src/schemas/Range.ts` -- Range type containing ComparatorSets, plus
  ComparatorSet type alias
- `src/schemas/VersionDiff.ts` -- Structured diff between two versions
- `src/utils/order.ts` -- SemVerOrder and SemVerOrderWithBuild instances
- `src/index.ts` -- barrel file with flat named exports. Classes are exported
  directly: `export { SemVer } from "./schemas/SemVer.js"`. Functions are
  exported directly from `utils/`. No namespace aggregation modules.

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
- JSON serialization via toJSON methods

---

## Rationale

### Why Schema.TaggedClass

Schema.TaggedClass provides the features needed by the data model:

1. **Discriminated unions via `_tag`:** Every instance carries a `_tag`
   string literal, enabling `Effect.Match` and `switch` discrimination
   across types (SemVer vs Comparator vs Range).

2. **Structural equality by default:** Schema.TaggedClass instances compare
   by value, not by reference. This is critical for SemVer where
   `1.0.0+build1` must equal `1.0.0+build2`.

3. **Immutability:** Instances are frozen. Bump operations return new
   instances rather than mutating.

4. **Hash derivation:** Hash is derived from Equal, so SemVer instances
   work correctly in HashSet and HashMap without custom hash functions.

5. **Built-in Schema support:** Schema.TaggedClass provides encode/decode
   capabilities for serialization and validation. Fields are expressed as
   Schema types (`Schema.Number`, `Schema.Array(Schema.String)`, etc.).

6. **Single class declaration:** Unlike Data.TaggedClass which required a
   split base pattern (`const FooBase = Data.TaggedClass("Foo")` +
   `class Foo extends FooBase<{...}>`), Schema.TaggedClass uses a single
   class expression: `class Foo extends Schema.TaggedClass<Foo>()("Foo", { ... })`.
   No `@internal` Base export is needed for schema classes.

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
export class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
  major: Schema.Number,
  minor: Schema.Number,
  patch: Schema.Number,
  prerelease: Schema.Array(Schema.Union(Schema.String, Schema.Number)),
  build: Schema.Array(Schema.String),
}) {
  // Static methods (wired in index.ts)
  static parse: (input: string) => Effect<SemVer, InvalidVersionError>;
  static compare: { (that: SemVer): (self: SemVer) => -1 | 0 | 1; (self: SemVer, that: SemVer): -1 | 0 | 1; };
  static gt: { ... }; static gte: { ... }; static lt: { ... }; static lte: { ... };
  static neq: { ... }; static equal: { ... }; static diff: { ... };
  static sort: (versions: ReadonlyArray<SemVer>) => Array<SemVer>;
  static rsort: (versions: ReadonlyArray<SemVer>) => Array<SemVer>;
  static max: (versions: ReadonlyArray<SemVer>) => Option<SemVer>;
  static min: (versions: ReadonlyArray<SemVer>) => Option<SemVer>;

  // Instance methods
  compare(that: SemVer): -1 | 0 | 1 { /* ... */ }
  gt(that: SemVer): boolean { /* ... */ }
  gte(that: SemVer): boolean { /* ... */ }
  lt(that: SemVer): boolean { /* ... */ }
  lte(that: SemVer): boolean { /* ... */ }
  eq(that: SemVer): boolean { /* ... */ }
  neq(that: SemVer): boolean { /* ... */ }
  get isPrerelease(): boolean { /* ... */ }
  get isStable(): boolean { /* ... */ }
  get bump(): SemVerBump { /* ... */ }

  // Traits
  [Equal.symbol](that: Equal.Equal): boolean { /* ... */ }
  [Hash.symbol](): number { /* ... */ }
  toString(): string { /* ... */ }
  toJSON(): unknown { /* ... */ }
  [Symbol.for("nodejs.util.inspect.custom")](): string { /* ... */ }
}
```

**Single class declaration:** Unlike error classes which use the split base
pattern, Schema.TaggedClass data types are declared as a single class with
no separate Base export. There is no `SemVerBase`.

**Instance methods:** SemVer provides instance methods for comparison
(`compare`, `gt`, `gte`, `lt`, `lte`, `eq`, `neq`), predicates
(`isPrerelease`, `isStable`), and bumping via the `bump` getter which returns
a `SemVerBump` helper with `major()`, `minor()`, `patch()`, `prerelease(id?)`,
and `release()` methods.

**Static methods:** SemVer provides static methods for parsing (`parse`),
comparison (`compare`, `gt`, etc.), collections (`sort`, `rsort`, `max`, `min`),
and diffing (`diff`). These are declared as static properties on the class
and wired to standalone function implementations in `index.ts` at module load.

**Field types are Schema types:** Fields use `Schema.Number`,
`Schema.Array(Schema.Union(Schema.String, Schema.Number))`, and
`Schema.Array(Schema.String)`. This provides built-in Schema encode/decode
support. Validation of non-negative integers and safe integer bounds is
still handled by the parser at parse time; the Schema types provide
structural type information.

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

**Why the override is mandatory:** The default equality performs shallow
reference comparison on arrays, which means two SemVer instances with
identical prerelease elements but different array references would not be
equal. Additionally, the default hash includes all fields, so build
metadata would affect hash values.

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

#### Construction

Schema.TaggedClass constructors take a single object argument with the field
values. Internal code (parser, bump operations) may pass
`{ disableValidation: true }` as a second argument to bypass runtime schema
validation for trusted inputs that are correct by construction. The parser
validates input before constructing instances; bump operations produce values
that are correct by construction.

---

### Comparator

**File:** `src/schemas/Comparator.ts`
**Tag:** `"Comparator"`

```typescript
export class Comparator extends Schema.TaggedClass<Comparator>()("Comparator", {
  operator: Schema.Literal("=", ">", ">=", "<", "<="),
  version: SemVer,
}) {
  // Static method (wired in index.ts)
  static parse: (input: string) => Effect<Comparator, InvalidComparatorError>;

  // Instance method
  test(version: SemVer): boolean { /* ... */ }

  toString(): string {
    const op = this.operator === "=" ? "" : this.operator;
    return `${op}${this.version.toString()}`;
  }
}
```

**Instance method `test`:** Tests whether a given version satisfies this
comparator by comparing it against the comparator's version using the
comparator's operator.

**Static method `parse`:** Parses a comparator string (e.g., `">=1.2.3"`).
Wired to `parseSingleComparator` in `index.ts`.

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
export class Range extends Schema.TaggedClass<Range>()("Range", {
  sets: Schema.Array(Schema.Array(Comparator)),
}) {
  // Static methods (wired in index.ts)
  static parse: (input: string) => Effect<Range, InvalidRangeError>;
  static satisfies: { (range: Range): (version: SemVer) => boolean; (version: SemVer, range: Range): boolean; };
  static filter: { ... }; static maxSatisfying: { ... }; static minSatisfying: { ... };

  // Instance methods
  test(version: SemVer): boolean { /* ... */ }
  filter(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> { /* ... */ }

  toString(): string {
    return this.sets.map((set) => set.map((c) => c.toString()).join(" ")).join(" || ");
  }
}
```

**Instance methods:** `test(version)` checks whether a version satisfies the
range. `filter(versions)` returns only the versions that satisfy the range.
Both use inlined matching logic to avoid circular imports with `utils/matching`.

**Static methods:** `parse` parses a range expression string. `satisfies`,
`filter`, `maxSatisfying`, and `minSatisfying` are dual-API collection
operations wired from `index.ts`.

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
export class VersionDiff extends Schema.TaggedClass<VersionDiff>()("VersionDiff", {
  type: Schema.Literal("major", "minor", "patch", "prerelease", "build", "none"),
  from: SemVer,
  to: SemVer,
  major: Schema.Number,
  minor: Schema.Number,
  patch: Schema.Number,
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
6. `src/index.ts` -- flat named exports from all subdirectories

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

All data types serialize to JSON via their `toJSON()` methods.

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

**Document Status:** Current -- reflects the complete implemented data model
using Schema.TaggedClass (single class declaration, no Base exports).
Schema classes provide instance methods (comparison, bumping, testing) and
static methods (parsing, collection operations) as the primary API.
All schemas, traits, instance/static methods, and serialization are
implemented and tested.
