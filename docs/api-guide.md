# API Guide

Complete reference for all public exports from `semver-effect`, organized by
category.

## Table of Contents

- [Data Types](#data-types)
- [Parsing](#parsing)
- [Comparison](#comparison)
- [Bumping](#bumping)
- [Ranges and Matching](#ranges-and-matching)
- [Range Algebra](#range-algebra)
- [Diff](#diff)
- [Ordering](#ordering)
- [Pretty Printing](#pretty-printing)
- [Services and Layers](#services-and-layers)
- [Errors](#errors)

---

## Data Types

### SemVer

The core version type. An immutable `Data.TaggedClass` with `Equal`, `Hash`,
and custom `toString`.

```typescript
import type { SemVer } from "semver-effect";
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
import { parseVersion } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseVersion("1.0.0+build1");
  const b = yield* parseVersion("1.0.0+build2");
  console.log(Equal.equals(a, b)); // true
});
```

### Comparator

A single version constraint: an operator paired with a version.

```typescript
import type { Comparator } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `operator` | `"=" \| ">" \| ">=" \| "<" \| "<="` | Comparison operator |
| `version` | `SemVer` | Version to compare against |

### Range

A set of comparator sets joined with OR semantics. Each inner array is a
comparator set (AND semantics).

```typescript
import type { Range, ComparatorSet } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `sets` | `ReadonlyArray<ReadonlyArray<Comparator>>` | OR-joined comparator sets |

The `toString()` method produces a normalized range string:

```typescript
import { Effect } from "effect";
import { parseRange } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* parseRange("^1.2.3 || ~2.0.0");
  console.log(range.toString()); // ">=1.2.3 <2.0.0-0 || >=2.0.0 <2.1.0-0"
});
```

### VersionDiff

A structured diff between two versions.

```typescript
import type { VersionDiff } from "semver-effect";
```

| Field | Type | Description |
| --- | --- | --- |
| `type` | `"major" \| "minor" \| "patch" \| "prerelease" \| "build" \| "none"` | Highest-level change |
| `from` | `SemVer` | Source version |
| `to` | `SemVer` | Target version |
| `major` | `number` | Delta in major component |
| `minor` | `number` | Delta in minor component |
| `patch` | `number` | Delta in patch component |

---

## Parsing

### parseVersion

Parse a string into a `SemVer`. Strict SemVer 2.0.0 only -- no `v` prefix, no
loose mode, no coercion.

```typescript
import { parseVersion } from "semver-effect";

// parseVersion: (input: string) => Effect<SemVer, InvalidVersionError>
```

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.2.3-alpha.1+build.456");
  console.log(v.major);      // 1
  console.log(v.prerelease); // ["alpha", 1]
  console.log(v.build);      // ["build", "456"]
});
```

### parseRange

Parse a range expression string into a `Range`. Supports caret, tilde,
X-ranges, hyphen ranges, and OR unions. The result is normalized (sorted
comparators, duplicates removed).

```typescript
import { parseRange } from "semver-effect";

// parseRange: (input: string) => Effect<Range, InvalidRangeError>
```

```typescript
import { Effect } from "effect";
import { parseRange } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* parseRange("^1.2.3");
  console.log(range.toString()); // ">=1.2.3 <2.0.0-0"
});
```

### parseComparator

Parse a single comparator string (operator + fully specified version).

```typescript
import { parseComparator } from "semver-effect";

// parseComparator: (input: string) => Effect<Comparator, InvalidComparatorError>
```

```typescript
import { Effect } from "effect";
import { parseComparator } from "semver-effect";

const program = Effect.gen(function* () {
  const comp = yield* parseComparator(">=2.0.0-rc.1");
  console.log(comp.operator);          // ">="
  console.log(comp.version.toString()); // "2.0.0-rc.1"
});
```

---

## Comparison

All comparison functions are dual -- they accept either `(self, that)` for
direct call or `(that)` for pipeable usage.

### compare

Returns `-1`, `0`, or `1`. Build metadata is ignored per the spec.

```typescript
import { compare } from "semver-effect";

// compare(self: SemVer, that: SemVer): -1 | 0 | 1
// compare(that: SemVer): (self: SemVer) => -1 | 0 | 1
```

### compareWithBuild

Like `compare`, but includes build metadata in the comparison for cases where
you need a total ordering including builds.

```typescript
import { compareWithBuild } from "semver-effect";
```

### equal, gt, gte, lt, lte, neq

Boolean comparison functions. All ignore build metadata.

```typescript
import { Effect, pipe } from "effect";
import { parseVersion, gt, lte } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseVersion("1.5.0");
  const b = yield* parseVersion("2.0.0");

  // Direct call
  console.log(gt(a, b));  // false
  console.log(lte(a, b)); // true

  // Pipeable
  const result = pipe(a, gt(b)); // false
});
```

### isPrerelease, isStable

Check whether a version has prerelease identifiers.

```typescript
import { Effect } from "effect";
import { parseVersion, isPrerelease, isStable } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.0.0-beta.1");
  console.log(isPrerelease(v)); // true
  console.log(isStable(v));     // false
});
```

### sort, rsort

Sort an array of versions in ascending or descending order.

```typescript
import { Effect } from "effect";
import { parseVersion, sort, rsort } from "semver-effect";

const program = Effect.gen(function* () {
  const versions = [
    yield* parseVersion("2.0.0"),
    yield* parseVersion("1.0.0"),
    yield* parseVersion("1.5.0"),
  ];

  console.log(sort(versions).map(String));  // ["1.0.0", "1.5.0", "2.0.0"]
  console.log(rsort(versions).map(String)); // ["2.0.0", "1.5.0", "1.0.0"]
});
```

### max, min

Find the highest or lowest version from an array. Returns `Option<SemVer>`.

```typescript
import { Effect, Option } from "effect";
import { parseVersion, max, min } from "semver-effect";

const program = Effect.gen(function* () {
  const versions = [
    yield* parseVersion("1.0.0"),
    yield* parseVersion("3.0.0"),
    yield* parseVersion("2.0.0"),
  ];

  console.log(Option.getOrNull(max(versions))?.toString()); // "3.0.0"
  console.log(Option.getOrNull(min(versions))?.toString()); // "1.0.0"
  console.log(Option.isNone(max([])));                      // true
});
```

### truncate

Strip prerelease or build metadata from a version.

```typescript
import { Effect } from "effect";
import { parseVersion, truncate } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.2.3-alpha+build");

  console.log(truncate(v, "build").toString());      // "1.2.3-alpha"
  console.log(truncate(v, "prerelease").toString()); // "1.2.3"
});
```

---

## Bumping

Bump functions create a new `SemVer` with the incremented component. They are
pure functions (no Effect wrapper needed).

### bumpMajor, bumpMinor, bumpPatch

```typescript
import { Effect } from "effect";
import { parseVersion, bumpMajor, bumpMinor, bumpPatch } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.2.3");

  console.log(bumpMajor(v).toString()); // "2.0.0"
  console.log(bumpMinor(v).toString()); // "1.3.0"
  console.log(bumpPatch(v).toString()); // "1.2.4"
});
```

### bumpPrerelease

Increment or add a prerelease identifier. Optionally provide a named prefix.

```typescript
import { Effect } from "effect";
import { parseVersion, bumpPrerelease } from "semver-effect";

const program = Effect.gen(function* () {
  const stable = yield* parseVersion("1.2.3");
  console.log(bumpPrerelease(stable).toString());         // "1.2.4-0"
  console.log(bumpPrerelease(stable, "beta").toString()); // "1.2.4-beta.0"

  const pre = yield* parseVersion("1.2.4-beta.0");
  console.log(bumpPrerelease(pre, "beta").toString());    // "1.2.4-beta.1"
  console.log(bumpPrerelease(pre, "rc").toString());      // "1.2.4-rc.0"
});
```

### bumpRelease

Strip prerelease and build metadata, keeping major.minor.patch.

```typescript
import { Effect } from "effect";
import { parseVersion, bumpRelease } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.2.3-beta.5+build");
  console.log(bumpRelease(v).toString()); // "1.2.3"
});
```

---

## Ranges and Matching

### satisfies

Check whether a version satisfies a range. Dual function.

```typescript
import { Effect, pipe } from "effect";
import { parseVersion, parseRange, satisfies } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.5.0");
  const range = yield* parseRange("^1.2.0");

  // Direct
  console.log(satisfies(v, range)); // true

  // Pipeable
  console.log(pipe(v, satisfies(range))); // true
});
```

Prerelease versions only satisfy a range if at least one comparator in the
matching set shares the same `[major, minor, patch]` tuple and has a prerelease.
This follows node-semver convention.

### filter

Filter an array of versions to those satisfying a range.

```typescript
import { filter } from "semver-effect";

// filter(versions: ReadonlyArray<SemVer>, range: Range): Array<SemVer>
// filter(range: Range): (versions: ReadonlyArray<SemVer>) => Array<SemVer>
```

### maxSatisfying, minSatisfying

Find the highest or lowest version satisfying a range. Returns
`Option<SemVer>`.

```typescript
import { Effect, Option } from "effect";
import { parseVersion, parseRange, maxSatisfying } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* parseRange("^1.0.0");
  const versions = [
    yield* parseVersion("1.0.0"),
    yield* parseVersion("1.5.0"),
    yield* parseVersion("2.0.0"),
  ];

  const best = maxSatisfying(versions, range);
  console.log(Option.getOrNull(best)?.toString()); // "1.5.0"
});
```

---

## Range Algebra

Operations for combining and analyzing ranges.

### union

Combine two ranges with OR semantics.

```typescript
import { Effect } from "effect";
import { parseRange, union } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseRange("^1.0.0");
  const b = yield* parseRange("^3.0.0");
  const combined = union(a, b);
  console.log(combined.toString());
  // ">=1.0.0 <2.0.0-0 || >=3.0.0 <4.0.0-0"
});
```

### intersect

Compute the intersection of two ranges. Fails with
`UnsatisfiableConstraintError` if no version can satisfy both ranges.

```typescript
import { Effect } from "effect";
import { parseRange, intersect } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseRange(">=1.0.0 <3.0.0");
  const b = yield* parseRange(">=2.0.0 <4.0.0");
  const result = yield* intersect(a, b);
  console.log(result.toString());
  // ">=2.0.0 <3.0.0"
});
```

### isSubset

Check whether every version matched by `sub` is also matched by `sup`.

```typescript
import { Effect } from "effect";
import { parseRange, isSubset } from "semver-effect";

const program = Effect.gen(function* () {
  const narrow = yield* parseRange("^1.5.0");
  const wide = yield* parseRange("^1.0.0");
  console.log(isSubset(narrow, wide)); // true
  console.log(isSubset(wide, narrow)); // false
});
```

### equivalent

Check whether two ranges match exactly the same set of versions.

```typescript
import { Effect } from "effect";
import { parseRange, equivalent } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseRange(">=1.0.0 <2.0.0-0");
  const b = yield* parseRange("^1.0.0");
  console.log(equivalent(a, b)); // true
});
```

### simplify

Remove redundant comparator sets from a range.

```typescript
import { Effect } from "effect";
import { parseRange, union, simplify } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseRange("^1.0.0");
  const b = yield* parseRange("^1.5.0");
  const combined = union(a, b);
  const simplified = simplify(combined);
  console.log(simplified.toString());
});
```

---

## Diff

### diff

Compute a structured diff between two versions. Returns a `VersionDiff`
describing the type and magnitude of the change.

```typescript
import { Effect } from "effect";
import { parseVersion, diff } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseVersion("1.2.3");
  const b = yield* parseVersion("2.0.0");
  const d = diff(a, b);

  console.log(d.type);  // "major"
  console.log(d.major); // 1
  console.log(d.minor); // -2
  console.log(d.patch); // -3
  console.log(d.toString()); // "major (1.2.3 -> 2.0.0)"
});
```

---

## Ordering

### SemVerOrder

An `Order<SemVer>` instance that implements SemVer 2.0.0 precedence rules.
Build metadata is ignored.

```typescript
import { SortedSet } from "effect";
import { SemVerOrder } from "semver-effect";

const set = SortedSet.empty<SemVer>(SemVerOrder);
```

### SemVerOrderWithBuild

Like `SemVerOrder` but includes build metadata for a total ordering.

---

## Pretty Printing

### prettyPrint

Format any `SemVer`, `Comparator`, `Range`, or `VersionDiff` as a string.

```typescript
import { prettyPrint } from "semver-effect";
import type { Printable } from "semver-effect";

// prettyPrint: (value: Printable) => string
```

---

## Services and Layers

### SemVerParser (service)

Service interface for parsing. Provides `parseVersion`, `parseRange`, and
`parseComparator` methods.

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
| `InvalidVersionError` | `parseVersion` | `input`, `position` |
| `InvalidRangeError` | `parseRange` | `input`, `position` |
| `InvalidComparatorError` | `parseComparator` | `input`, `position` |
| `InvalidPrereleaseError` | Prerelease operations | `input` |
| `InvalidBumpError` | Bump operations | -- |
| `UnsatisfiedRangeError` | `VersionCache.resolve` | `range`, `available` |
| `UnsatisfiableConstraintError` | `intersect` | `constraints` |
| `EmptyCacheError` | `VersionCache` queries | -- |
| `VersionNotFoundError` | `VersionCache.diff`, `next`, `prev` | `version` |
| `VersionFetchError` | `VersionFetcher.fetch` | -- |

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const program = parseVersion("not-valid").pipe(
  Effect.catchTag("InvalidVersionError", (err) => {
    console.log(err.message);   // 'Invalid version string: "not-valid" at position 0'
    console.log(err.input);     // "not-valid"
    console.log(err.position);  // 0
    return Effect.succeed(undefined);
  }),
);
```
