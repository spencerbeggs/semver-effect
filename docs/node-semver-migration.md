# Migrating from node-semver

A practical guide for replacing `node-semver` with `semver-effect` in Effect
applications.

## Table of Contents

- [Key Differences](#key-differences)
- [Side-by-Side Comparison](#side-by-side-comparison)
- [Migration Patterns](#migration-patterns)
- [What is NOT Supported](#what-is-not-supported)

---

## Key Differences

| Aspect | node-semver | semver-effect |
| --- | --- | --- |
| Error handling | Returns `null` on failure | Returns typed `Effect` error |
| Parsing mode | Loose mode, coercion, `v` prefix | Strict SemVer 2.0.0 only |
| Return types | Strings and `SemVer` objects | `Data.TaggedClass` instances |
| Immutability | Mutable `SemVer` objects | Frozen `Data.TaggedClass` instances |
| Effect integration | None | Native services, layers, typed errors |
| Range algebra | Not available | `intersect`, `union`, `isSubset`, `equivalent`, `simplify` |
| Version cache | Not available | `VersionCache` service with resolution, grouping, navigation |

---

## Side-by-Side Comparison

### Parsing a Version

**node-semver:**

```typescript
import semver from "semver";

const version = semver.parse("1.2.3");
if (version === null) {
  throw new Error("Invalid version");
}
console.log(version.major); // 1
```

**semver-effect:**

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const program = Effect.gen(function* () {
  const version = yield* parseVersion("1.2.3");
  console.log(version.major); // 1
});
```

### Comparing Versions

**node-semver:**

```typescript
import semver from "semver";

semver.gt("1.2.3", "1.0.0");      // true
semver.compare("1.2.3", "2.0.0"); // -1
semver.sort(["2.0.0", "1.0.0"]);  // ["1.0.0", "2.0.0"]
```

**semver-effect:**

```typescript
import { Effect } from "effect";
import { parseVersion, gt, compare, sort } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseVersion("1.2.3");
  const b = yield* parseVersion("1.0.0");
  const c = yield* parseVersion("2.0.0");

  gt(a, b);              // true
  compare(a, c);         // -1
  sort([c, b]).map(String); // ["1.0.0", "2.0.0"]
});
```

Note: `semver-effect` comparison functions operate on parsed `SemVer` objects,
not raw strings. Parse first, then compare.

### Range Matching

**node-semver:**

```typescript
import semver from "semver";

semver.satisfies("1.5.0", "^1.2.0");                     // true
semver.maxSatisfying(["1.0.0", "1.5.0", "2.0.0"], "^1"); // "1.5.0"
```

**semver-effect:**

```typescript
import { Effect, Option } from "effect";
import { parseVersion, parseRange, satisfies, maxSatisfying } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.5.0");
  const range = yield* parseRange("^1.2.0");
  satisfies(v, range); // true

  const versions = yield* Effect.all([
    parseVersion("1.0.0"),
    parseVersion("1.5.0"),
    parseVersion("2.0.0"),
  ]);
  const best = maxSatisfying(versions, range);
  console.log(Option.getOrNull(best)?.toString()); // "1.5.0"
});
```

### Incrementing Versions

**node-semver:**

```typescript
import semver from "semver";

semver.inc("1.2.3", "major");             // "2.0.0"
semver.inc("1.2.3", "minor");             // "1.3.0"
semver.inc("1.2.3", "prerelease", "beta"); // "1.2.4-beta.0"
```

**semver-effect:**

```typescript
import { Effect } from "effect";
import { parseVersion, bumpMajor, bumpMinor, bumpPrerelease } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.2.3");

  bumpMajor(v).toString();             // "2.0.0"
  bumpMinor(v).toString();             // "1.3.0"
  bumpPrerelease(v, "beta").toString(); // "1.2.4-beta.0"
});
```

### Diffing Versions

**node-semver:**

```typescript
import semver from "semver";

semver.diff("1.0.0", "2.0.0"); // "major"
```

**semver-effect:**

```typescript
import { Effect } from "effect";
import { parseVersion, diff } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseVersion("1.0.0");
  const b = yield* parseVersion("2.0.0");
  const d = diff(a, b);
  console.log(d.type);  // "major"
  console.log(d.major); // 1 (also provides numeric deltas)
});
```

---

## Migration Patterns

### Wrapping Existing String-Based Code

If you have existing code that passes version strings around, start by adding
parsing at the boundaries:

```typescript
import { Effect } from "effect";
import type { SemVer } from "semver-effect";
import { parseVersion, gt } from "semver-effect";

// Before: passing strings
function isNewer(a: string, b: string): boolean {
  return semver.gt(a, b);
}

// After: parse at the boundary, pass SemVer objects internally
const isNewer = (a: SemVer, b: SemVer): boolean => gt(a, b);

// At the entry point
const program = Effect.gen(function* () {
  const a = yield* parseVersion(userInputA);
  const b = yield* parseVersion(userInputB);
  return isNewer(a, b);
});
```

### Replacing `null` Checks with Effect

**Before:**

```typescript
const version = semver.parse(input);
if (version === null) {
  console.error("Invalid version");
  return;
}
// use version
```

**After:**

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const program = parseVersion(input).pipe(
  Effect.catchTag("InvalidVersionError", (err) => {
    console.error(err.message);
    return Effect.fail(err);
  }),
);
```

### Handling the `v` Prefix

node-semver accepts `v1.2.3` by default. `semver-effect` does not. If your
input may contain a `v` prefix, strip it before parsing:

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const parseWithVPrefix = (input: string) => {
  const cleaned = input.startsWith("v") || input.startsWith("V")
    ? input.slice(1)
    : input;
  return parseVersion(cleaned);
};
```

---

## What is NOT Supported

### No Loose Mode

node-semver's `loose` option accepts non-compliant version strings like
`1.2.3.4`, `1.2`, or `1.2.3`. `semver-effect` is strict SemVer 2.0.0
only. Input must be a valid version string per the spec.

**Why:** Loose mode creates ambiguity. The SemVer 2.0.0 spec defines a precise
grammar, and accepting non-compliant strings makes behavior unpredictable.

### No Coercion

node-semver's `coerce()` converts partial strings like `"v1"` or `"3.2"`
into full versions. `semver-effect` does not provide coercion.

**Why:** Coercion is lossy -- it invents missing components (defaulting to
zero). If you need this behavior, coerce manually before parsing:

```typescript
const coerce = (input: string): string => {
  const parts = input.replace(/^v/i, "").split(".");
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).join(".");
};
```

### No `clean()`

node-semver's `clean()` strips whitespace and the `v` prefix.
`semver-effect` trims leading/trailing whitespace during parsing but does not
accept the `v` prefix.

### No `valid()` Returning a String

node-semver's `valid()` returns the cleaned version string or `null`.
In `semver-effect`, use `parseVersion` and call `.toString()`:

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const valid = (input: string) =>
  parseVersion(input).pipe(
    Effect.map((v) => v.toString()),
    Effect.orElseSucceed(() => null),
  );
```

### No `Range.test()` Method

node-semver `Range` objects have a `.test(version)` method.
In `semver-effect`, use the `satisfies` function:

```typescript
import { satisfies } from "semver-effect";

// node-semver:  range.test(version)
// semver-effect: satisfies(version, range)
```

### No `outside()` or `gtr()` / `ltr()`

These node-semver utilities for testing whether a version is above or below
a range are not directly provided. You can compose them from existing
primitives:

```typescript
import { Effect } from "effect";
import { parseVersion, parseRange, satisfies, gt, lt, sort, filter } from "semver-effect";

// Check if version is greater than all versions in a range
// by checking it doesn't satisfy and is greater than the max satisfying
```

### No `intersects()` on Range

node-semver provides `range1.intersects(range2)`. In `semver-effect`, use the
`intersect` function from range algebra, which returns the actual intersection
or fails if the ranges are incompatible:

```typescript
import { Effect } from "effect";
import { parseRange, intersect } from "semver-effect";

const doRangesOverlap = (a: string, b: string) =>
  Effect.gen(function* () {
    const rangeA = yield* parseRange(a);
    const rangeB = yield* parseRange(b);
    return yield* intersect(rangeA, rangeB);
  }).pipe(
    Effect.map(() => true),
    Effect.catchTag("UnsatisfiableConstraintError", () => Effect.succeed(false)),
  );
```
