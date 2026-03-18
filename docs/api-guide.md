# API Guide

Complete reference for all public exports from `semver-effect`. All exports
are flat -- import them directly by name.

## Table of Contents

- [SemVer (class)](#semver-class)
- [Parsing](#parsing)
- [Comparison](#comparison)
- [Predicates](#predicates)
- [Sorting](#sorting)
- [Truncate](#truncate)
- [Bumping](#bumping)
- [Diff](#diff)
- [Order and Equivalence](#order-and-equivalence)
- [Range (class)](#range-class)
- [Comparator (class)](#comparator-class)
- [Range Matching](#range-matching)
- [Range Algebra](#range-algebra)
- [VersionDiff (class)](#versiondiff-class)
- [Pretty Printing](#pretty-printing)
- [Services and Layers](#services-and-layers)
- [Errors](#errors)

---

## SemVer (class)

The core version type. An immutable `Schema.TaggedClass` with `Equal`, `Hash`,
and custom `toString`. Provides instance methods for comparison, bumping, and
predicates, plus static methods for parsing and collection operations.

```typescript
import { SemVer } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `major` | `number` | Major version (non-negative integer) |
| `minor` | `number` | Minor version (non-negative integer) |
| `patch` | `number` | Patch version (non-negative integer) |
| `prerelease` | `ReadonlyArray<string \| number>` | Prerelease identifiers |
| `build` | `ReadonlyArray<string>` | Build metadata identifiers |

Equality ignores build metadata per the SemVer 2.0.0 spec. Two versions
differing only in build metadata are considered equal.

```typescript
import { Effect, Equal } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.0.0+build1");
  const b = yield* SemVer.parse("1.0.0+build2");
  console.log(Equal.equals(a, b)); // true
});
```

### Construction

Construct directly -- all fields are required:

```typescript
import { SemVer } from "semver-effect";

const v = new SemVer({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
const pre = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["alpha", 1], build: [] });
const withBuild = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: ["build.42"] });
```

### Static Methods

| Method | Signature | Description |
| --- | --- | --- |
| `SemVer.parse` | `(input: string) => Effect<SemVer, InvalidVersionError>` | Parse a strict SemVer 2.0.0 string |
| `SemVer.compare` | `(a, b) => -1 \| 0 \| 1` | Compare two versions (dual API) |
| `SemVer.gt` | `(a, b) => boolean` | Test `a > b` (dual API) |
| `SemVer.gte` | `(a, b) => boolean` | Test `a >= b` (dual API) |
| `SemVer.lt` | `(a, b) => boolean` | Test `a < b` (dual API) |
| `SemVer.lte` | `(a, b) => boolean` | Test `a <= b` (dual API) |
| `SemVer.neq` | `(a, b) => boolean` | Test `a !== b` (dual API) |
| `SemVer.equal` | `(a, b) => boolean` | Test `a === b` (dual API) |
| `SemVer.diff` | `(a, b) => VersionDiff` | Compute structured diff (dual API) |
| `SemVer.sort` | `(versions) => Array<SemVer>` | Sort ascending |
| `SemVer.rsort` | `(versions) => Array<SemVer>` | Sort descending |
| `SemVer.max` | `(versions) => Option<SemVer>` | Highest version |
| `SemVer.min` | `(versions) => Option<SemVer>` | Lowest version |

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.2.3");
  const b = yield* SemVer.parse("2.0.0");

  SemVer.compare(a, b);  // -1
  SemVer.gt(b, a);       // true
  SemVer.sort([b, a]);   // [a, b]
});
```

### Instance Methods

| Method | Signature | Description |
| --- | --- | --- |
| `v.compare(that)` | `(that: SemVer) => -1 \| 0 \| 1` | Compare per SemVer precedence |
| `v.gt(that)` | `(that: SemVer) => boolean` | Test `this > that` |
| `v.gte(that)` | `(that: SemVer) => boolean` | Test `this >= that` |
| `v.lt(that)` | `(that: SemVer) => boolean` | Test `this < that` |
| `v.lte(that)` | `(that: SemVer) => boolean` | Test `this <= that` |
| `v.eq(that)` | `(that: SemVer) => boolean` | Test equality (ignores build) |
| `v.neq(that)` | `(that: SemVer) => boolean` | Test inequality |
| `v.isPrerelease` | `boolean` (getter) | Whether this is a prerelease version |
| `v.isStable` | `boolean` (getter) | Whether this is a stable release |
| `v.bump.major()` | `() => SemVer` | Bump major (resets minor, patch, prerelease) |
| `v.bump.minor()` | `() => SemVer` | Bump minor (resets patch, prerelease) |
| `v.bump.patch()` | `() => SemVer` | Bump patch (resets prerelease) |
| `v.bump.prerelease(id?)` | `(id?: string) => SemVer` | Bump prerelease with optional prefix |
| `v.bump.release()` | `() => SemVer` | Strip prerelease and build |

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.2.3-alpha.1");

  v.compare(yield* SemVer.parse("2.0.0"));  // -1
  v.gt(yield* SemVer.parse("1.0.0"));       // true
  v.isPrerelease;                            // true
  v.isStable;                                // false

  v.bump.major().toString();                 // "2.0.0"
  v.bump.minor().toString();                 // "1.3.0"
  v.bump.patch().toString();                 // "1.2.4"
  v.bump.prerelease("alpha").toString();     // "1.2.3-alpha.2"
  v.bump.release().toString();               // "1.2.3"
});
```

---

## Parsing

### SemVer.parse / parseValidSemVer

Parse a string into a `SemVer`. Strict SemVer 2.0.0 only -- no `v` prefix, no
loose mode, no coercion.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.2.3-alpha.1+build.456");
  console.log(v.major);      // 1
  console.log(v.prerelease); // ["alpha", 1]
  console.log(v.build);      // ["build", "456"]
});
```

The standalone function `parseValidSemVer` is identical:

```typescript
import { parseValidSemVer } from "semver-effect";

// parseValidSemVer: (input: string) => Effect<SemVer, InvalidVersionError>
```

### Range.parse / parseRange

Parse a range expression string into a `Range`. Supports caret, tilde,
X-ranges, hyphen ranges, and OR unions. The result is normalized (sorted
comparators, duplicates removed).

```typescript
import { Effect } from "effect";
import { Range } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* Range.parse("^1.2.3");
  console.log(range.toString()); // ">=1.2.3 <2.0.0-0"
});
```

The standalone function `parseRange` is identical:

```typescript
import { parseRange } from "semver-effect";

// parseRange: (input: string) => Effect<Range, InvalidRangeError>
```

### Comparator.parse / parseSingleComparator

Parse a single comparator string (operator + fully specified version).

```typescript
import { Effect } from "effect";
import { Comparator } from "semver-effect";

const program = Effect.gen(function* () {
  const comp = yield* Comparator.parse(">=2.0.0-rc.1");
  console.log(comp.operator);          // ">="
  console.log(comp.version.toString()); // "2.0.0-rc.1"
});
```

The standalone function `parseSingleComparator` is identical:

```typescript
import { parseSingleComparator } from "semver-effect";

// parseSingleComparator: (input: string) => Effect<Comparator, InvalidComparatorError>
```

---

## Comparison

All comparison functions are dual -- they accept either `(self, that)` for
direct call or `(that)` for pipeable usage. These are the same operations
available as instance methods on `SemVer`.

`compare` returns `-1`, `0`, or `1`. Build metadata is ignored per the spec.
`compareWithBuild` is like `compare` but includes build metadata for a total
ordering.

`equal`, `gt`, `gte`, `lt`, `lte`, `neq` are boolean comparison functions.
All ignore build metadata.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.5.0");
  const b = yield* SemVer.parse("2.0.0");

  // Instance methods (primary)
  a.gt(b);   // false
  a.lte(b);  // true

  // Static methods
  SemVer.gt(a, b);   // false
  SemVer.lte(a, b);  // true
});
```

Standalone functions for pipe composition:

```typescript
import { Effect, pipe } from "effect";
import { parseValidSemVer, gt, lte } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseValidSemVer("1.5.0");
  const b = yield* parseValidSemVer("2.0.0");
  console.log(gt(a, b));  // false
  console.log(lte(a, b)); // true
  const result = pipe(a, gt(b)); // false
});
```

---

## Predicates

Check whether a version has prerelease identifiers. Available as instance
getters or standalone functions.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.0.0-beta.1");

  // Instance getters (primary)
  console.log(v.isPrerelease); // true
  console.log(v.isStable);     // false
});
```

Standalone functions:

```typescript
import { isPrerelease, isStable } from "semver-effect";

console.log(isPrerelease(v)); // true
console.log(isStable(v));     // false
```

---

## Sorting

Sort an array of versions in ascending or descending order. `max` and `min`
return `Option<SemVer>`. Available as static methods on `SemVer` or as
standalone functions.

```typescript
import { Effect, Option } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const versions = [
    yield* SemVer.parse("2.0.0"),
    yield* SemVer.parse("1.0.0"),
    yield* SemVer.parse("1.5.0"),
  ];

  // Static methods (primary)
  console.log(SemVer.sort(versions).map(String));  // ["1.0.0", "1.5.0", "2.0.0"]
  console.log(SemVer.rsort(versions).map(String)); // ["2.0.0", "1.5.0", "1.0.0"]
  console.log(Option.getOrNull(SemVer.max(versions))?.toString()); // "2.0.0"
});
```

Standalone functions (`sort`, `rsort`, `max`, `min`) are also available.

---

## Truncate

Strip prerelease or build metadata from a version.

```typescript
import { Effect } from "effect";
import { SemVer, truncate } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.2.3-alpha+build");
  console.log(truncate(v, "build").toString());      // "1.2.3-alpha"
  console.log(truncate(v, "prerelease").toString()); // "1.2.3"
});
```

---

## Bumping

Bump operations create a new `SemVer` with the incremented component. Available
as instance methods via `v.bump.*` or as standalone functions.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.2.3");

  // Instance methods (primary)
  console.log(v.bump.major().toString()); // "2.0.0"
  console.log(v.bump.minor().toString()); // "1.3.0"
  console.log(v.bump.patch().toString()); // "1.2.4"
});
```

Prerelease and release bumps:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const stable = yield* SemVer.parse("1.2.3");
  console.log(stable.bump.prerelease().toString());         // "1.2.4-0"
  console.log(stable.bump.prerelease("beta").toString());   // "1.2.4-beta.0"

  const pre = yield* SemVer.parse("1.2.4-beta.0");
  console.log(pre.bump.prerelease("beta").toString());      // "1.2.4-beta.1"

  const v2 = yield* SemVer.parse("1.2.3-beta.5+build");
  console.log(v2.bump.release().toString()); // "1.2.3"
});
```

Standalone functions (`bumpMajor`, `bumpMinor`, `bumpPatch`, `bumpPrerelease`,
`bumpRelease`) are also available for pipe composition.

---

## Diff

Compute a structured diff between two versions. Returns a `VersionDiff`
describing the type and magnitude of the change. Available as a static method
on `SemVer` or as a standalone function.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.2.3");
  const b = yield* SemVer.parse("2.0.0");

  // Static method (primary)
  const d = SemVer.diff(a, b);
  console.log(d.type);  // "major"
  console.log(d.major); // 1
  console.log(d.toString()); // "major (1.2.3 -> 2.0.0)"
});
```

Standalone function:

```typescript
import { diff } from "semver-effect";

const d = diff(a, b);
```

---

## Order and Equivalence

`SemVerOrder` is an `Order<SemVer>` instance implementing SemVer 2.0.0
precedence rules (build metadata ignored). `SemVerOrderWithBuild` includes
build metadata for a total ordering.

```typescript
import { SortedSet } from "effect";
import { SemVer, SemVerOrder } from "semver-effect";

const set = SortedSet.empty<SemVer>(SemVerOrder);
```

---

## Range (class)

A set of comparator sets joined with OR semantics. Each inner array is a
comparator set (AND semantics). Provides instance methods for testing and
filtering, plus static methods for parsing and collection operations.

```typescript
import { Range } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `sets` | `ReadonlyArray<ReadonlyArray<Comparator>>` | OR-joined comparator sets |

### Static Methods

| Method | Signature | Description |
| --- | --- | --- |
| `Range.parse` | `(input: string) => Effect<Range, InvalidRangeError>` | Parse a range expression |
| `Range.satisfies` | `(v, r) => boolean` | Test version against range (dual API) |
| `Range.filter` | `(versions, r) => ReadonlyArray<SemVer>` | Filter satisfying versions (dual API) |
| `Range.maxSatisfying` | `(versions, r) => Option<SemVer>` | Highest satisfying (dual API) |
| `Range.minSatisfying` | `(versions, r) => Option<SemVer>` | Lowest satisfying (dual API) |

### Instance Methods

| Method | Signature | Description |
| --- | --- | --- |
| `range.test(version)` | `(version: SemVer) => boolean` | Test whether a version satisfies this range |
| `range.filter(versions)` | `(versions: ReadonlyArray<SemVer>) => ReadonlyArray<SemVer>` | Filter versions satisfying this range |

```typescript
import { Effect } from "effect";
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* Range.parse("^1.2.3 || ~2.0.0");
  const v = yield* SemVer.parse("1.5.0");

  // Instance methods (primary)
  range.test(v);                 // true
  range.filter([v]);             // [v]

  // Static methods (dual API)
  Range.satisfies(v, range);     // true

  console.log(range.toString()); // ">=1.2.3 <2.0.0-0 || >=2.0.0 <2.1.0-0"
});
```

---

## Comparator (class)

A single version constraint: an operator paired with a version. Provides
instance methods for testing, plus a static method for parsing.

```typescript
import { Comparator } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `operator` | `"=" \| ">" \| ">=" \| "<" \| "<="` | Comparison operator |
| `version` | `SemVer` | Version to compare against |

### Static Methods

| Method | Signature | Description |
| --- | --- | --- |
| `Comparator.parse` | `(input: string) => Effect<Comparator, InvalidComparatorError>` | Parse a comparator string |

### Instance Methods

| Method | Signature | Description |
| --- | --- | --- |
| `comp.test(version)` | `(version: SemVer) => boolean` | Test whether a version satisfies this comparator |

```typescript
import { Effect } from "effect";
import { Comparator, SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const comp = yield* Comparator.parse(">=1.0.0");
  const v = yield* SemVer.parse("1.5.0");
  console.log(comp.test(v)); // true
});
```

---

## Range Matching

`satisfies`, `filter`, `maxSatisfying`, and `minSatisfying` check versions
against ranges. These are available as instance methods on `Range`,
static methods on `Range`, and standalone functions.

`satisfies` is a dual function (direct and pipeable). Prerelease versions only
satisfy a range if at least one comparator in the matching set shares the same
`[major, minor, patch]` tuple and has a prerelease. This follows node-semver
convention.

```typescript
import { Effect, Option } from "effect";
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.5.0");
  const range = yield* Range.parse("^1.2.0");

  // Instance methods (primary)
  console.log(range.test(v)); // true

  const versions = [
    yield* SemVer.parse("1.0.0"),
    yield* SemVer.parse("1.5.0"),
    yield* SemVer.parse("2.0.0"),
  ];
  console.log(range.filter(versions).map(String)); // ["1.0.0", "1.5.0"]

  // Static methods (dual API)
  Range.satisfies(v, range); // true
  const best = Range.maxSatisfying(versions, range);
  console.log(Option.getOrNull(best)?.toString()); // "1.5.0"
});
```

Standalone functions for pipe composition:

```typescript
import { Effect, pipe } from "effect";
import { parseValidSemVer, parseRange, satisfies } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseValidSemVer("1.5.0");
  const range = yield* parseRange("^1.2.0");

  // Direct
  console.log(satisfies(v, range)); // true

  // Pipeable
  console.log(pipe(v, satisfies(range))); // true
});
```

---

## Range Algebra

Operations for combining and analyzing ranges.

```typescript
import { Effect } from "effect";
import { Range, union, intersect, isSubset, equivalent, simplify } from "semver-effect";

const program = Effect.gen(function* () {
  // union -- combine with OR semantics
  const a = yield* Range.parse("^1.0.0");
  const b = yield* Range.parse("^3.0.0");
  const combined = union(a, b);
  console.log(combined.toString());
  // ">=1.0.0 <2.0.0-0 || >=3.0.0 <4.0.0-0"

  // intersect -- may fail with UnsatisfiableConstraintError
  const c = yield* Range.parse(">=1.0.0 <3.0.0");
  const d = yield* Range.parse(">=2.0.0 <4.0.0");
  const result = yield* intersect(c, d);
  console.log(result.toString()); // ">=2.0.0 <3.0.0"

  // isSubset
  const narrow = yield* Range.parse("^1.5.0");
  const wide = yield* Range.parse("^1.0.0");
  console.log(isSubset(narrow, wide)); // true

  // equivalent
  const e = yield* Range.parse(">=1.0.0 <2.0.0-0");
  const f = yield* Range.parse("^1.0.0");
  console.log(equivalent(e, f)); // true

  // simplify -- remove redundant comparator sets
  const g = union(a, yield* Range.parse("^1.5.0"));
  const simplified = simplify(g);
  console.log(simplified.toString());
});
```

---

## VersionDiff (class)

A structured diff between two versions. Produced by `diff` or `SemVer.diff`.

```typescript
import { VersionDiff } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `type` | `"major" \| "minor" \| "patch" \| "prerelease" \| "build" \| "none"` | Highest-level change |
| `from` | `SemVer` | Source version |
| `to` | `SemVer` | Target version |
| `major` | `number` | Delta in major component |
| `minor` | `number` | Delta in minor component |
| `patch` | `number` | Delta in patch component |

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.2.3");
  const b = yield* SemVer.parse("2.0.0");
  const d = SemVer.diff(a, b);

  console.log(d.type);  // "major"
  console.log(d.major); // 1
  console.log(d.minor); // -2
  console.log(d.patch); // -3
  console.log(d.toString()); // "major (1.2.3 -> 2.0.0)"
});
```

---

## Pretty Printing

Cross-cutting pretty printing for all schema types.

```typescript
import { prettyPrint } from "semver-effect";
import type { Printable } from "semver-effect";

// prettyPrint: (value: Printable) => string
```

Accepts any `SemVer`, `Comparator`, `Range`, or `VersionDiff` instance.

---

## Services and Layers

Services and layers are flat exports.

### SemVerParser (service)

Service interface for parsing. Provides `parseVersion`, `parseRange`, and
`parseComparator` methods. Defined as a class-based `Context.Tag`.

### SemVerParserLive (layer)

The live implementation of `SemVerParser`. Provide it to programs that depend
on the `SemVerParser` service:

```typescript
program.pipe(Effect.provide(SemVerParserLive));
```

### VersionCache (service)

A queryable cache of known versions. See
[Effect Integration](./effect-integration.md) for full documentation.

### VersionCacheLive (layer)

The live implementation of `VersionCache`. Requires `SemVerParser`:

```typescript
program.pipe(Effect.provide(VersionCacheLive), Effect.provide(SemVerParserLive));
```

### VersionFetcher (service)

An interface for fetching version lists from external sources (e.g., npm
registry). You provide your own implementation.

---

## Errors

All errors extend `Data.TaggedError` and can be matched with
`Effect.catchTag`.

| Error | Produced by | Key fields |
| --- | --- | --- |
| `InvalidVersionError` | `SemVer.parse`, `parseValidSemVer` | `input`, `position` |
| `InvalidRangeError` | `Range.parse`, `parseRange` | `input`, `position` |
| `InvalidComparatorError` | `Comparator.parse`, `parseSingleComparator` | `input`, `position` |
| `InvalidPrereleaseError` | Prerelease operations | `input` |
| `InvalidBumpError` | Bump operations | -- |
| `UnsatisfiedRangeError` | `VersionCache.resolve` | `range`, `available` |
| `UnsatisfiableConstraintError` | `intersect` | `constraints` |
| `EmptyCacheError` | `VersionCache` queries | -- |
| `VersionNotFoundError` | `VersionCache.diff`, `next`, `prev` | `version` |
| `VersionFetchError` | `VersionFetcher.fetch` | -- |

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = SemVer.parse("not-valid").pipe(
  Effect.catchTag("InvalidVersionError", (err) => {
    console.log(err.message);   // 'Invalid version string: "not-valid" at position 0'
    console.log(err.input);     // "not-valid"
    console.log(err.position);  // 0
    return Effect.succeed(undefined);
  }),
);
```
