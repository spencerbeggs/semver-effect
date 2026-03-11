# semver-effect

[![npm version](https://img.shields.io/npm/v/semver-effect)](https://www.npmjs.com/package/semver-effect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Strict SemVer 2.0.0 implementation built on Effect. Every operation returns
typed errors through Effect's error channel -- no `null`, no exceptions, no
loose mode.

## Features

- Effect-idiomatic namespaced API (`SemVer.*`, `Range.*`) matching Effect's own conventions
- Strict SemVer 2.0.0 parsing with precise error positions (recursive descent, no regex)
- Typed error channel for every operation -- handle `InvalidVersionError`, `UnsatisfiedRangeError`, and others explicitly
- Range algebra: intersect, union, subset, equivalence, and simplification
- Dual-style API: all comparison and matching functions support both `pipe` and direct call

## Installation

```bash
npm install semver-effect effect
```

## Quick Start

```typescript
import { Effect, pipe } from "effect";
import { SemVer, Range } from "semver-effect";

// Direct construction -- no parsing needed
const v = SemVer.make(1, 4, 2);
const next = SemVer.bump.minor(v);            // 1.5.0
pipe(v, SemVer.gt(SemVer.make(0, 9, 0)));     // true

// Parsing strings returns Effect with typed errors
const program = Effect.gen(function* () {
  const version = yield* SemVer.fromString("1.4.2");
  const range = yield* Range.fromString("^1.2.0");

  Range.satisfies(version, range);             // true
  SemVer.gt(version, yield* SemVer.fromString("1.3.0")); // true
  SemVer.compare(version, yield* SemVer.fromString("2.0.0")); // -1
});

Effect.runSync(program);
```

## Documentation

For API reference, Effect integration patterns, migration guides, and SemVer
spec compliance details, see [docs/](./docs/).

## License

MIT
