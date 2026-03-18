# Getting Started

## Installation

Install `semver-effect` alongside its peer dependency `effect`:

```bash
# pnpm
pnpm add semver-effect effect

# npm
npm install semver-effect effect

# bun
bun add semver-effect effect
```

`semver-effect` requires `effect` version `^3.19.19` or later.

## Your First Program

### Parsing a Version

Use `SemVer.parse` to parse a version string. It returns an `Effect` that
either succeeds with a `SemVer` instance or fails with a typed error:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const version = yield* SemVer.parse("2.1.0-beta.3+build.42");

  console.log(version.major);      // 2
  console.log(version.minor);      // 1
  console.log(version.patch);      // 0
  console.log(version.prerelease); // ["beta", 3]
  console.log(version.build);      // ["build", "42"]
  console.log(version.toString()); // "2.1.0-beta.3+build.42"
});

Effect.runSync(program);
```

Invalid input produces a typed `InvalidVersionError` with position information:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = SemVer.parse("v1.0.0"); // "v" prefix is not valid SemVer

Effect.runSync(
  program.pipe(
    Effect.catchTag("InvalidVersionError", (err) => {
      console.log(err.message); // 'Invalid version string: "v1.0.0" at position 0'
      return Effect.succeed(undefined);
    }),
  ),
);
```

The standalone function `parseValidSemVer` is also available:

```typescript
import { parseValidSemVer } from "semver-effect";

const v = yield* parseValidSemVer("2.1.0");
```

### Comparing Versions

SemVer instances have instance methods for comparison. Standalone functions
with dual (direct and pipeable) calling styles are also available:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.parse("1.0.0");
  const b = yield* SemVer.parse("2.3.1");
  const c = yield* SemVer.parse("1.5.0");

  // Instance methods
  console.log(a.compare(b));  // -1
  console.log(b.gt(a));       // true
  console.log(a.lt(c));       // true
  console.log(a.isStable);    // true

  // Static methods for collections
  const sorted = SemVer.sort([b, a, c]);
  console.log(sorted.map(String)); // ["1.0.0", "1.5.0", "2.3.1"]
});

Effect.runSync(program);
```

Standalone functions for pipe composition:

```typescript
import { Effect, pipe } from "effect";
import { parseValidSemVer, compare, gt, lt, sort } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* parseValidSemVer("1.0.0");
  const b = yield* parseValidSemVer("2.3.1");

  // Direct call style
  console.log(compare(a, b));  // -1
  console.log(gt(b, a));       // true

  // Pipeable style
  const isGreater = pipe(b, gt(a));
  console.log(isGreater); // true
});

Effect.runSync(program);
```

### Range Matching

Parse range expressions and check whether versions satisfy them:

```typescript
import { Effect } from "effect";
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* Range.parse(">=1.2.0 <2.0.0");

  const v1 = yield* SemVer.parse("1.5.3");
  const v2 = yield* SemVer.parse("2.0.0");
  const v3 = yield* SemVer.parse("1.2.0");

  // Instance methods
  console.log(range.test(v1)); // true
  console.log(range.test(v2)); // false
  console.log(range.test(v3)); // true

  // Filter a list of versions against a range
  const versions = [v1, v2, v3];
  const matching = range.filter(versions);
  console.log(matching.map(String)); // ["1.5.3", "1.2.0"]
});

Effect.runSync(program);
```

Standalone functions for pipe composition:

```typescript
import { Effect } from "effect";
import { parseValidSemVer, parseRange, satisfies, filter } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* parseRange(">=1.2.0 <2.0.0");
  const v1 = yield* parseValidSemVer("1.5.3");

  console.log(satisfies(v1, range)); // true
});

Effect.runSync(program);
```

Ranges support the standard node-semver syntax: caret (`^1.2.3`), tilde
(`~1.2.3`), X-ranges (`1.x`, `1.2.*`), hyphen ranges (`1.0.0 - 2.0.0`),
and OR unions (`>=1.0.0 || >=3.0.0`).

## Using the SemVerParser Service

For applications that need dependency injection or testability, use the
`SemVerParser` service instead of the standalone functions:

```typescript
import { Effect } from "effect";
import { SemVerParser, SemVerParserLive } from "semver-effect";

const program = Effect.gen(function* () {
  const parser = yield* SemVerParser;
  const version = yield* parser.parseVersion("3.0.0-alpha.1");
  const range = yield* parser.parseRange("^3.0.0-alpha.0");
  const comparator = yield* parser.parseComparator(">=3.0.0");

  console.log(version.toString());    // "3.0.0-alpha.1"
  console.log(range.toString());      // ">=3.0.0-alpha.0 <4.0.0-0"
  console.log(comparator.toString()); // ">=3.0.0"
});

// Provide the live layer
Effect.runSync(program.pipe(Effect.provide(SemVerParserLive)));
```

The service approach lets you swap implementations for testing or provide
custom parsing behavior by implementing the `SemVerParser` interface.

## Next Steps

- [API Guide](./api-guide.md) -- full reference for all exported functions
- [Effect Integration](./effect-integration.md) -- services, layers, and
  error handling patterns
- [node-semver Migration](./node-semver-migration.md) -- migrating from
  node-semver
- [SemVer Spec Compliance](./semver-spec-compliance.md) -- spec details and
  edge cases
- [Advanced Example](./advanced-example.md) -- building a document version
  system with Effect
