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
| API style | Function-only | Class-based (instance + static methods) with standalone functions for pipe |
| Error handling | Returns `null` on failure | Returns typed `Effect` error |
| Parsing mode | Loose mode, coercion, `v` prefix | Strict SemVer 2.0.0 only |
| Return types | Strings and `SemVer` objects | `Schema.TaggedClass` instances |
| Immutability | Mutable `SemVer` objects | Frozen `Schema.TaggedClass` instances |
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
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const version = yield* SemVer.parse("1.2.3");
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
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.2.3");
  const b = yield* SemVer.parse("1.0.0");
  const c = yield* SemVer.parse("2.0.0");

  // Instance methods
  a.gt(b);                         // true
  a.compare(c);                    // -1

  // Static methods for collections
  SemVer.sort([c, b]).map(String); // ["1.0.0", "2.0.0"]
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
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.5.0");
  const range = yield* Range.parse("^1.2.0");

  // Instance method
  range.test(v); // true

  // Static method for collections
  const versions = yield* Effect.all([
    SemVer.parse("1.0.0"),
    SemVer.parse("1.5.0"),
    SemVer.parse("2.0.0"),
  ]);
  const best = Range.maxSatisfying(versions, range);
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
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.parse("1.2.3");

  // Instance methods (primary)
  v.bump.major().toString();             // "2.0.0"
  v.bump.minor().toString();             // "1.3.0"
  v.bump.prerelease("beta").toString();  // "1.2.4-beta.0"
});
```

Standalone functions are also available:

```typescript
import { parseValidSemVer, bumpMajor, bumpMinor, bumpPrerelease } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseValidSemVer("1.2.3");
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
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.0.0");
  const b = yield* SemVer.parse("2.0.0");

  // Static method (primary)
  const d = SemVer.diff(a, b);
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
import { SemVer } from "semver-effect";

// Before: passing strings
function isNewer(a: string, b: string): boolean {
  return semver.gt(a, b);
}

// After: parse at the boundary, use instance methods internally
const isNewer = (a: SemVer, b: SemVer): boolean => a.gt(b);

// At the entry point
const program = Effect.gen(function* () {
  const a = yield* SemVer.parse(userInputA);
  const b = yield* SemVer.parse(userInputB);
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
import { SemVer } from "semver-effect";

const program = SemVer.parse(input).pipe(
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
import { SemVer } from "semver-effect";

const parseWithVPrefix = (input: string) => {
  const cleaned = input.startsWith("v") || input.startsWith("V")
    ? input.slice(1)
    : input;
  return SemVer.parse(cleaned);
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
In `semver-effect`, use `SemVer.parse` and call `.toString()`:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const valid = (input: string) =>
  SemVer.parse(input).pipe(
    Effect.map((v) => v.toString()),
    Effect.orElseSucceed(() => null),
  );
```

### Range.test() IS Supported

Unlike earlier versions, `semver-effect` now provides `range.test(version)` as
an instance method, matching node-semver's API:

```typescript
import { SemVer, Range } from "semver-effect";

// node-semver:     range.test(version)
// semver-effect:   range.test(version)  -- same!
// Also available:  satisfies(version, range)
```

### No `outside()` or `gtr()` / `ltr()`

These node-semver utilities for testing whether a version is above or below
a range are not directly provided. You can compose them from existing
primitives:

```typescript
import { Effect } from "effect";
import { Range } from "semver-effect";

// Check if version is greater than all versions in a range
// by checking it doesn't satisfy and is greater than the max satisfying
```

### No `intersects()` on Range

node-semver provides `range1.intersects(range2)`. In `semver-effect`, use the
`intersect` function from range algebra, which returns the actual intersection
or fails if the ranges are incompatible:

```typescript
import { Effect } from "effect";
import { Range, intersect } from "semver-effect";

const doRangesOverlap = (a: string, b: string) =>
  Effect.gen(function* () {
    const rangeA = yield* Range.parse(a);
    const rangeB = yield* Range.parse(b);
    return yield* intersect(rangeA, rangeB);
  }).pipe(
    Effect.map(() => true),
    Effect.catchTag("UnsatisfiableConstraintError", () => Effect.succeed(false)),
  );
```
