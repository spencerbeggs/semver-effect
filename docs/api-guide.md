# API Guide

Complete reference for all public exports from `semver-effect`, organized by
namespaced module.

## Table of Contents

- [SemVer](#semver)
- [Range](#range)
- [Comparator](#comparator)
- [VersionDiff](#versiondiff)
- [PrettyPrint](#prettyprint)
- [Services and Layers](#services-and-layers)
- [Errors](#errors)

---

## SemVer

All version-related operations live under the `SemVer` namespace.

```typescript
import { SemVer } from "semver-effect";
```

### Type

The core version type. An immutable `Data.TaggedClass` with `Equal`, `Hash`,
and custom `toString`.

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
  const a = yield* SemVer.fromString("1.0.0+build1");
  const b = yield* SemVer.fromString("1.0.0+build2");
  console.log(Equal.equals(a, b)); // true
});
```

### Construction

```typescript
import { SemVer } from "semver-effect";

// Convenience constructor
const v = SemVer.make(1, 2, 3);
const pre = SemVer.make(1, 0, 0, ["alpha", 1]);
const withBuild = SemVer.make(1, 0, 0, [], ["build.42"]);

// Zero constant
const zero = SemVer.ZERO; // 0.0.0
```

### Parsing (fromString)

Parse a string into a `SemVer`. Strict SemVer 2.0.0 only -- no `v` prefix, no
loose mode, no coercion.

```typescript
import { SemVer } from "semver-effect";

// SemVer.fromString: (input: string) => Effect<SemVer.SemVer, InvalidVersionError>
```

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.fromString("1.2.3-alpha.1+build.456");
  console.log(v.major);      // 1
  console.log(v.prerelease); // ["alpha", 1]
  console.log(v.build);      // ["build", "456"]
});
```

### Comparison

All comparison functions are dual -- they accept either `(self, that)` for
direct call or `(that)` for pipeable usage.

`compare` returns `-1`, `0`, or `1`. Build metadata is ignored per the spec.
`compareWithBuild` is like `compare` but includes build metadata for a total
ordering.

`equal`, `gt`, `gte`, `lt`, `lte`, `neq` are boolean comparison functions.
All ignore build metadata.

```typescript
import { Effect, pipe } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.fromString("1.5.0");
  const b = yield* SemVer.fromString("2.0.0");
  console.log(SemVer.gt(a, b));  // false
  console.log(SemVer.lte(a, b)); // true
  const result = pipe(a, SemVer.gt(b)); // false
});
```

### Predicates

Check whether a version has prerelease identifiers.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.fromString("1.0.0-beta.1");
  console.log(SemVer.isPrerelease(v)); // true
  console.log(SemVer.isStable(v));     // false
});
```

### Sorting (sort, rsort, max, min)

Sort an array of versions in ascending or descending order. `max` and `min`
return `Option<SemVer>`.

```typescript
import { Effect, Option } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const versions = [
    yield* SemVer.fromString("2.0.0"),
    yield* SemVer.fromString("1.0.0"),
    yield* SemVer.fromString("1.5.0"),
  ];
  console.log(SemVer.sort(versions).map(String));  // ["1.0.0", "1.5.0", "2.0.0"]
  console.log(SemVer.rsort(versions).map(String)); // ["2.0.0", "1.5.0", "1.0.0"]
  console.log(Option.getOrNull(SemVer.max(versions))?.toString()); // "2.0.0"
});
```

### Truncate

Strip prerelease or build metadata from a version.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.fromString("1.2.3-alpha+build");
  console.log(SemVer.truncate(v, "build").toString());      // "1.2.3-alpha"
  console.log(SemVer.truncate(v, "prerelease").toString()); // "1.2.3"
});
```

### Bumping (bump.\*)

Bump functions create a new `SemVer` with the incremented component. They are
pure functions (no Effect wrapper needed).

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.fromString("1.2.3");
  console.log(SemVer.bump.major(v).toString()); // "2.0.0"
  console.log(SemVer.bump.minor(v).toString()); // "1.3.0"
  console.log(SemVer.bump.patch(v).toString()); // "1.2.4"
});
```

Prerelease and release bumps:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const stable = yield* SemVer.fromString("1.2.3");
  console.log(SemVer.bump.prerelease(stable).toString());         // "1.2.4-0"
  console.log(SemVer.bump.prerelease(stable, "beta").toString()); // "1.2.4-beta.0"

  const pre = yield* SemVer.fromString("1.2.4-beta.0");
  console.log(SemVer.bump.prerelease(pre, "beta").toString());    // "1.2.4-beta.1"

  const v2 = yield* SemVer.fromString("1.2.3-beta.5+build");
  console.log(SemVer.bump.release(v2).toString()); // "1.2.3"
});
```

### Diff

Compute a structured diff between two versions. Returns a `VersionDiff`
describing the type and magnitude of the change.

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.fromString("1.2.3");
  const b = yield* SemVer.fromString("2.0.0");
  const d = SemVer.diff(a, b);
  console.log(d.type);  // "major"
  console.log(d.major); // 1
  console.log(d.toString()); // "major (1.2.3 -> 2.0.0)"
});
```

### Effect Instances (Order, OrderWithBuild, Equivalence)

`SemVer.Order` is an `Order<SemVer>` instance implementing SemVer 2.0.0
precedence rules (build metadata ignored). `SemVer.OrderWithBuild` includes
build metadata for a total ordering. `SemVer.Equivalence` is an
`Equivalence<SemVer>` (build metadata ignored).

```typescript
import { SortedSet } from "effect";
import { SemVer } from "semver-effect";

const set = SortedSet.empty<SemVer.SemVer>(SemVer.Order);

const eq = SemVer.Equivalence;
console.log(eq(SemVer.make(1, 0, 0), SemVer.make(1, 0, 0))); // true
```

### Schema (Instance, FromString)

`SemVer.Instance` validates that a value is a `SemVer` instance.
`SemVer.FromString` decodes a string into a `SemVer` and encodes back to
string.

```typescript
import { Schema } from "effect";
import { SemVer } from "semver-effect";

// Validate a SemVer instance
Schema.decodeUnknownSync(SemVer.Instance)(someSemVer);

// Parse a string into a SemVer via Schema
Schema.decodeUnknownSync(SemVer.FromString)("1.2.3");
```

---

## Range

All range operations live under the `Range` namespace.

```typescript
import { Range } from "semver-effect";
```

### Type

A set of comparator sets joined with OR semantics. Each inner array is a
comparator set (AND semantics).

| Field | Type | Description |
| --- | --- | --- |
| `sets` | `ReadonlyArray<ReadonlyArray<Comparator>>` | OR-joined comparator sets |

The `toString()` method produces a normalized range string:

```typescript
import { Effect } from "effect";
import { Range } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* Range.fromString("^1.2.3 || ~2.0.0");
  console.log(range.toString()); // ">=1.2.3 <2.0.0-0 || >=2.0.0 <2.1.0-0"
});
```

### Parsing (fromString)

Parse a range expression string into a `Range`. Supports caret, tilde,
X-ranges, hyphen ranges, and OR unions. The result is normalized (sorted
comparators, duplicates removed).

```typescript
import { Range } from "semver-effect";

// Range.fromString: (input: string) => Effect<Range.Range, InvalidRangeError>
```

```typescript
import { Effect } from "effect";
import { Range } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* Range.fromString("^1.2.3");
  console.log(range.toString()); // ">=1.2.3 <2.0.0-0"
});
```

### Constants

```typescript
import { Range } from "semver-effect";

const all = Range.any; // matches any version (>=0.0.0)
```

### Matching

`satisfies`, `filter`, `maxSatisfying`, and `minSatisfying` check versions
against ranges.

`satisfies` is a dual function (direct and pipeable). Prerelease versions only
satisfy a range if at least one comparator in the matching set shares the same
`[major, minor, patch]` tuple and has a prerelease. This follows node-semver
convention.

```typescript
import { Effect, Option, pipe } from "effect";
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.fromString("1.5.0");
  const range = yield* Range.fromString("^1.2.0");

  // Direct
  console.log(Range.satisfies(v, range)); // true

  // Pipeable
  console.log(pipe(v, Range.satisfies(range))); // true

  // Filter, maxSatisfying, minSatisfying
  const versions = [
    yield* SemVer.fromString("1.0.0"),
    yield* SemVer.fromString("1.5.0"),
    yield* SemVer.fromString("2.0.0"),
  ];
  console.log(Range.filter(versions, range).map(String)); // ["1.0.0", "1.5.0"]

  const best = Range.maxSatisfying(versions, range);
  console.log(Option.getOrNull(best)?.toString()); // "1.5.0"
});
```

### Algebra

Operations for combining and analyzing ranges.

```typescript
import { Effect } from "effect";
import { Range } from "semver-effect";

const program = Effect.gen(function* () {
  // union — combine with OR semantics
  const a = yield* Range.fromString("^1.0.0");
  const b = yield* Range.fromString("^3.0.0");
  const combined = Range.union(a, b);
  console.log(combined.toString());
  // ">=1.0.0 <2.0.0-0 || >=3.0.0 <4.0.0-0"

  // intersect — may fail with UnsatisfiableConstraintError
  const c = yield* Range.fromString(">=1.0.0 <3.0.0");
  const d = yield* Range.fromString(">=2.0.0 <4.0.0");
  const result = yield* Range.intersect(c, d);
  console.log(result.toString()); // ">=2.0.0 <3.0.0"

  // isSubset
  const narrow = yield* Range.fromString("^1.5.0");
  const wide = yield* Range.fromString("^1.0.0");
  console.log(Range.isSubset(narrow, wide)); // true

  // equivalent
  const e = yield* Range.fromString(">=1.0.0 <2.0.0-0");
  const f = yield* Range.fromString("^1.0.0");
  console.log(Range.equivalent(e, f)); // true

  // simplify — remove redundant comparator sets
  const g = Range.union(a, yield* Range.fromString("^1.5.0"));
  const simplified = Range.simplify(g);
  console.log(simplified.toString());
});
```

### Schema (Instance, FromString)

`Range.Instance` validates that a value is a `Range` instance.
`Range.FromString` decodes a string into a `Range` and encodes back to string.

```typescript
import { Schema } from "effect";
import { Range } from "semver-effect";

Schema.decodeUnknownSync(Range.Instance)(someRange);
Schema.decodeUnknownSync(Range.FromString)("^1.2.3");
```

---

## Comparator

All comparator operations live under the `Comparator` namespace.

```typescript
import { Comparator } from "semver-effect";
```

### Type

A single version constraint: an operator paired with a version.

| Field | Type | Description |
| --- | --- | --- |
| `operator` | `"=" \| ">" \| ">=" \| "<" \| "<="` | Comparison operator |
| `version` | `SemVer` | Version to compare against |

### Parsing (fromString)

Parse a single comparator string (operator + fully specified version).

```typescript
import { Comparator } from "semver-effect";

// Comparator.fromString: (input: string) => Effect<Comparator.Comparator, InvalidComparatorError>
```

```typescript
import { Effect } from "effect";
import { Comparator } from "semver-effect";

const program = Effect.gen(function* () {
  const comp = yield* Comparator.fromString(">=2.0.0-rc.1");
  console.log(comp.operator);          // ">="
  console.log(comp.version.toString()); // "2.0.0-rc.1"
});
```

### Constants

```typescript
import { Comparator } from "semver-effect";

const all = Comparator.any; // matches any version (>=0.0.0)
```

### Schema (Instance, FromString)

`Comparator.Instance` validates that a value is a `Comparator` instance.
`Comparator.FromString` decodes a string into a `Comparator` and encodes back
to string.

```typescript
import { Schema } from "effect";
import { Comparator } from "semver-effect";

Schema.decodeUnknownSync(Comparator.Instance)(someComparator);
Schema.decodeUnknownSync(Comparator.FromString)(">=1.2.3");
```

---

## VersionDiff

A structured diff between two versions. Produced by `SemVer.diff`.

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
  const a = yield* SemVer.fromString("1.2.3");
  const b = yield* SemVer.fromString("2.0.0");
  const d = SemVer.diff(a, b);

  console.log(d.type);  // "major"
  console.log(d.major); // 1
  console.log(d.minor); // -2
  console.log(d.patch); // -3
  console.log(d.toString()); // "major (1.2.3 -> 2.0.0)"
});
```

---

## PrettyPrint

Cross-cutting pretty printing for all schema types.

```typescript
import { PrettyPrint } from "semver-effect";
import type { PrettyPrint as PP } from "semver-effect";

// PrettyPrint.prettyPrint: (value: PP.Printable) => string
```

Accepts any `SemVer`, `Comparator`, `Range`, or `VersionDiff` instance.

---

## Services and Layers

Services and layers are flat exports (not namespaced).

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
| `InvalidVersionError` | `SemVer.fromString` | `input`, `position` |
| `InvalidRangeError` | `Range.fromString` | `input`, `position` |
| `InvalidComparatorError` | `Comparator.fromString` | `input`, `position` |
| `InvalidPrereleaseError` | Prerelease operations | `input` |
| `InvalidBumpError` | Bump operations | -- |
| `UnsatisfiedRangeError` | `VersionCache.resolve` | `range`, `available` |
| `UnsatisfiableConstraintError` | `Range.intersect` | `constraints` |
| `EmptyCacheError` | `VersionCache` queries | -- |
| `VersionNotFoundError` | `VersionCache.diff`, `next`, `prev` | `version` |
| `VersionFetchError` | `VersionFetcher.fetch` | -- |

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = SemVer.fromString("not-valid").pipe(
  Effect.catchTag("InvalidVersionError", (err) => {
    console.log(err.message);   // 'Invalid version string: "not-valid" at position 0'
    console.log(err.input);     // "not-valid"
    console.log(err.position);  // 0
    return Effect.succeed(undefined);
  }),
);
```
