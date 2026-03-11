# semver-effect

[![npm version](https://img.shields.io/npm/v/semver-effect)](https://www.npmjs.com/package/semver-effect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Strict SemVer 2.0.0 implementation built on Effect. Every operation returns
typed errors through Effect's error channel -- no `null`, no exceptions, no
loose mode.

## Features

- Strict SemVer 2.0.0 parsing with precise error positions (recursive descent, no regex)
- Typed error channel for every operation -- handle `InvalidVersionError`, `UnsatisfiedRangeError`, and others explicitly
- Range algebra: intersect, union, subset, equivalence, and simplification
- Version cache service for querying, resolving, and navigating sets of versions
- Dual-style API: all comparison and matching functions support both `pipe` and direct call

## Installation

```bash
npm install semver-effect effect
```

## Quick Start

```typescript
import { Effect } from "effect";
import type { SemVer } from "semver-effect";
import { parseVersion, parseRange, satisfies, gt, compare } from "semver-effect";

const program = Effect.gen(function* () {
  const version: SemVer = yield* parseVersion("1.4.2");
  const range = yield* parseRange("^1.2.0");

  console.log(satisfies(version, range)); // true
  console.log(gt(version, yield* parseVersion("1.3.0"))); // true
  console.log(compare(version, yield* parseVersion("2.0.0"))); // -1
});

Effect.runSync(program);
```

## Documentation

For API reference, Effect integration patterns, migration guides, and SemVer
spec compliance details, see [docs](./docs).

## License

MIT
