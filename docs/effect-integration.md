# Effect Integration

How `semver-effect` fits into an Effect program, including services, layers,
error handling, and composition patterns.

## Table of Contents

- [Standalone Functions vs Services](#standalone-functions-vs-services)
- [The SemVerParser Service](#the-semverparser-service)
- [The VersionCache Service](#the-versioncache-service)
- [The VersionFetcher Service](#the-versionfetcher-service)
- [Error Handling Patterns](#error-handling-patterns)
- [Composing Services](#composing-services)
- [Layer Composition](#layer-composition)

---

## Standalone Functions vs Services

`semver-effect` provides two ways to use its API:

**Standalone functions** -- imported directly and called without providing any
layers. These are pure functions or functions that return `Effect` values with
no service requirements.

```typescript
import { Effect } from "effect";
import { parseVersion, compare, satisfies, bumpMajor, diff } from "semver-effect";

// No layers needed -- these work standalone
const program = Effect.gen(function* () {
  const v = yield* parseVersion("1.2.3");
  const bumped = bumpMajor(v);
  console.log(compare(v, bumped)); // -1
});

Effect.runSync(program);
```

Standalone functions include: `parseVersion`, `parseRange`, `parseComparator`,
all comparison functions, all bump functions, `satisfies`, `filter`,
`maxSatisfying`, `minSatisfying`, `diff`, all algebra functions, `sort`,
`rsort`, `max`, `min`, `truncate`, and `prettyPrint`.

**Services** -- accessed through Effect's dependency injection. Use these when
you need testability, multiple cache instances, or composition with other
Effect services.

```typescript
import { Effect } from "effect";
import { SemVerParser, SemVerParserLive } from "semver-effect";

const program = Effect.gen(function* () {
  const parser = yield* SemVerParser;
  const v = yield* parser.parseVersion("1.2.3");
});

// Must provide the layer
Effect.runSync(program.pipe(Effect.provide(SemVerParserLive)));
```

---

## The SemVerParser Service

`SemVerParser` provides parsing methods as an Effect service. The interface:

```typescript
interface SemVerParser {
  readonly parseVersion: (input: string) => Effect<SemVer, InvalidVersionError>;
  readonly parseRange: (input: string) => Effect<Range, InvalidRangeError>;
  readonly parseComparator: (input: string) => Effect<Comparator, InvalidComparatorError>;
}
```

### Providing the Layer

The `SemVerParserLive` layer has no dependencies -- it can be provided
directly:

```typescript
import { Effect, Layer } from "effect";
import { SemVerParser, SemVerParserLive } from "semver-effect";

const program = Effect.gen(function* () {
  const parser = yield* SemVerParser;
  const version = yield* parser.parseVersion("2.0.0");
  return version;
});

Effect.runSync(program.pipe(Effect.provide(SemVerParserLive)));
```

### Testing with a Mock Parser

Replace the parser with a test implementation:

```typescript
import { Effect, Layer } from "effect";
import type { SemVer } from "semver-effect";
import { SemVerParser, SemVer as SemVerClass } from "semver-effect";

const TestParserLive = Layer.succeed(
  SemVerParser,
  SemVerParser.of({
    parseVersion: (_input) =>
      Effect.succeed(
        new SemVerClass(
          { major: 1, minor: 0, patch: 0, prerelease: [], build: [] },
          { disableValidation: true },
        ),
      ),
    parseRange: (_input) => Effect.fail(/* ... */),
    parseComparator: (_input) => Effect.fail(/* ... */),
  }),
);
```

---

## The VersionCache Service

`VersionCache` is a stateful service that holds a sorted set of versions
and provides querying, resolution, grouping, and navigation operations.

### Creating and Loading

```typescript
import { Effect } from "effect";
import {
  SemVerParserLive,
  VersionCache,
  VersionCacheLive,
  parseVersion,
} from "semver-effect";

const program = Effect.gen(function* () {
  const cache = yield* VersionCache;

  // Load versions into the cache
  const versions = yield* Effect.all([
    parseVersion("1.0.0"),
    parseVersion("1.1.0"),
    parseVersion("1.2.0"),
    parseVersion("2.0.0"),
    parseVersion("2.1.0"),
  ]);
  yield* cache.load(versions);

  // Query
  const latest = yield* cache.latest();
  console.log(latest.toString()); // "2.1.0"

  const oldest = yield* cache.oldest();
  console.log(oldest.toString()); // "1.0.0"

  // List all versions
  const all = yield* cache.versions;
  console.log(all.map(String));
  // ["1.0.0", "1.1.0", "1.2.0", "2.0.0", "2.1.0"]
});

// VersionCacheLive requires SemVerParser
Effect.runSync(
  program.pipe(
    Effect.provide(VersionCacheLive),
    Effect.provide(SemVerParserLive),
  ),
);
```

### Resolving Ranges

Find the highest version satisfying a range:

```typescript
import { Effect } from "effect";
import {
  VersionCache,
  VersionCacheLive,
  SemVerParserLive,
  parseVersion,
  parseRange,
} from "semver-effect";

const program = Effect.gen(function* () {
  const cache = yield* VersionCache;

  yield* cache.load([
    yield* parseVersion("1.0.0"),
    yield* parseVersion("1.5.0"),
    yield* parseVersion("2.0.0"),
  ]);

  // Resolve with a parsed Range
  const range = yield* parseRange("^1.0.0");
  const resolved = yield* cache.resolve(range);
  console.log(resolved.toString()); // "1.5.0"

  // Resolve from a string directly
  const resolved2 = yield* cache.resolveString("^2.0.0");
  console.log(resolved2.toString()); // "2.0.0"
});
```

### Mutation

```typescript
const program = Effect.gen(function* () {
  const cache = yield* VersionCache;

  yield* cache.load([yield* parseVersion("1.0.0")]);
  yield* cache.add(yield* parseVersion("1.1.0"));
  yield* cache.remove(yield* parseVersion("1.0.0"));

  const all = yield* cache.versions;
  console.log(all.map(String)); // ["1.1.0"]
});
```

### Grouping

```typescript
const program = Effect.gen(function* () {
  const cache = yield* VersionCache;
  // ... load versions ...

  // Group by major version
  const groups = yield* cache.groupBy("major");
  // Map { "1" => [1.0.0, 1.1.0, 1.2.0], "2" => [2.0.0, 2.1.0] }

  // Get the latest version per major
  const latestPerMajor = yield* cache.latestByMajor();
  console.log(latestPerMajor.map(String)); // ["1.2.0", "2.1.0"]

  // Get the latest version per minor
  const latestPerMinor = yield* cache.latestByMinor();
  console.log(latestPerMinor.map(String)); // ["1.0.0", "1.1.0", "1.2.0", "2.0.0", "2.1.0"]
});
```

### Navigation

```typescript
import { Effect, Option } from "effect";
import { VersionCache, parseVersion } from "semver-effect";

const program = Effect.gen(function* () {
  const cache = yield* VersionCache;
  // ... load versions [1.0.0, 1.1.0, 1.2.0, 2.0.0] ...

  const v = yield* parseVersion("1.1.0");

  const next = yield* cache.next(v);
  console.log(Option.getOrNull(next)?.toString()); // "1.2.0"

  const prev = yield* cache.prev(v);
  console.log(Option.getOrNull(prev)?.toString()); // "1.0.0"

  // Diff between two cached versions
  const d = yield* cache.diff(
    yield* parseVersion("1.0.0"),
    yield* parseVersion("2.0.0"),
  );
  console.log(d.type); // "major"
});
```

---

## The VersionFetcher Service

`VersionFetcher` is an interface for fetching version lists from external
sources. You provide your own implementation -- `semver-effect` does not
include a built-in fetcher.

```typescript
interface VersionFetcher {
  readonly fetch: (packageName: string) => Effect<ReadonlyArray<SemVer>, VersionFetchError>;
}
```

### Example: npm Registry Fetcher

```typescript
import { Effect, Layer } from "effect";
import {
  VersionFetcher,
  VersionCache,
  VersionCacheLive,
  SemVerParserLive,
  parseVersion,
} from "semver-effect";

const NpmFetcherLive = Layer.succeed(
  VersionFetcher,
  VersionFetcher.of({
    fetch: (packageName) =>
      Effect.gen(function* () {
        // Your HTTP logic here to call the npm registry
        // Return an array of parsed SemVer instances
        return [];
      }),
  }),
);

// Compose with VersionCache for a complete resolution pipeline
const program = Effect.gen(function* () {
  const fetcher = yield* VersionFetcher;
  const cache = yield* VersionCache;

  const versions = yield* fetcher.fetch("effect");
  yield* cache.load(versions);

  const resolved = yield* cache.resolveString("^3.0.0");
  console.log(resolved.toString());
});
```

---

## Error Handling Patterns

### Catching Specific Errors

All errors are tagged, so you can catch them individually:

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const program = parseVersion(userInput).pipe(
  Effect.catchTag("InvalidVersionError", (err) =>
    Effect.succeed(fallbackVersion),
  ),
);
```

### Catching Multiple Error Types

```typescript
import { Effect } from "effect";
import { parseVersion, parseRange, satisfies } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseVersion(versionInput);
  const r = yield* parseRange(rangeInput);
  return satisfies(v, r);
}).pipe(
  Effect.catchTags({
    InvalidVersionError: (err) =>
      Effect.fail(new UserError(`Bad version: ${err.input}`)),
    InvalidRangeError: (err) =>
      Effect.fail(new UserError(`Bad range: ${err.input}`)),
  }),
);
```

### Recovering with Default Values

```typescript
import { Effect } from "effect";
import { parseVersion } from "semver-effect";

const parseOrDefault = (input: string) =>
  parseVersion(input).pipe(
    Effect.orElseSucceed(() => defaultVersion),
  );
```

---

## Composing Services

### Building a Version Resolution Pipeline

```typescript
import { Effect } from "effect";
import {
  SemVerParser,
  VersionCache,
  VersionFetcher,
  SemVerParserLive,
  VersionCacheLive,
} from "semver-effect";

const resolvePackageVersion = (
  packageName: string,
  rangeString: string,
) =>
  Effect.gen(function* () {
    const fetcher = yield* VersionFetcher;
    const cache = yield* VersionCache;

    const versions = yield* fetcher.fetch(packageName);
    yield* cache.load(versions);
    return yield* cache.resolveString(rangeString);
  });
```

---

## Layer Composition

### Dependency Graph

```text
SemVerParserLive          (no dependencies)
       |
       v
VersionCacheLive          (requires SemVerParser)
```

### Composing Layers

```typescript
import { Layer } from "effect";
import { SemVerParserLive, VersionCacheLive } from "semver-effect";

// Compose into a single layer that provides both services
const FullLive = VersionCacheLive.pipe(
  Layer.provideMerge(SemVerParserLive),
);

// Use it
Effect.runSync(program.pipe(Effect.provide(FullLive)));
```

### Multiple Cache Instances

Because `VersionCache` is backed by `Ref`, each layer provision creates an
independent cache. This is useful when you need to track versions for
different packages:

```typescript
import { Effect } from "effect";
import { VersionCache, VersionCacheLive, SemVerParserLive } from "semver-effect";

// Each Effect.provide(VersionCacheLive) creates a fresh, independent cache
const cacheA = programA.pipe(
  Effect.provide(VersionCacheLive),
  Effect.provide(SemVerParserLive),
);

const cacheB = programB.pipe(
  Effect.provide(VersionCacheLive),
  Effect.provide(SemVerParserLive),
);
```
