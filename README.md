# semver-effect

[![npm version](https://img.shields.io/npm/v/semver-effect)](https://www.npmjs.com/package/semver-effect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Strict SemVer 2.0.0 implementation built on Effect. Every operation returns
typed errors through Effect's error channel -- no `null`, no exceptions, no
loose mode.

## Features

- Class-based API with instance methods (`v.bump.minor()`, `range.test(v)`) and static methods (`SemVer.parse()`, `Range.parse()`)
- Standalone functions for pipe/data-last composition (`gt`, `satisfies`, `bumpMajor`, etc.)
- Strict SemVer 2.0.0 parsing with precise error positions (recursive descent, no regex)
- Typed error channel for every operation -- handle `InvalidVersionError`, `UnsatisfiedRangeError`, and others explicitly
- Range algebra: intersect, union, subset, equivalence, and simplification

## Installation

```bash
npm install semver-effect effect
```

## Quick Start

```typescript
import { Effect } from "effect";
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  // Parse strings with static methods -- typed errors in the Effect channel
  const v = yield* SemVer.parse("1.4.2");
  const range = yield* Range.parse("^1.2.0");

  // Instance methods for comparison, bumping, and matching
  range.test(v);                                              // true
  v.gt(yield* SemVer.parse("1.3.0"));                        // true
  v.compare(yield* SemVer.parse("2.0.0"));                   // -1
  v.bump.minor().toString();                                  // "1.5.0"
  v.isStable;                                                 // true
});

Effect.runSync(program);
```

Standalone functions are also available for pipe/data-last composition:

```typescript
import { Effect, pipe } from "effect";
import { SemVer, parseValidSemVer, parseRange, bumpMinor, gt, satisfies } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* parseValidSemVer("1.4.2");
  const range = yield* parseRange("^1.2.0");

  satisfies(v, range);                                        // true
  pipe(v, gt(yield* parseValidSemVer("1.3.0")));              // true
  bumpMinor(v).toString();                                    // "1.5.0"
});

Effect.runSync(program);
```

## Documentation

For API reference, Effect integration patterns, migration guides, and SemVer
spec compliance details, see [docs/](./docs/).

## License

[MIT](LICENSE)
