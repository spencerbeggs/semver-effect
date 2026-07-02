# semver-effect

## 0.3.1

### Bug Fixes

* [`1cafcf2`](https://github.com/spencerbeggs/semver-effect/commit/1cafcf20b6a15cfc7fbb9a69c08723e9e93488c6) Barrel marked with side effects for bundling.

## 0.3.0

### Documentation

* [`b9e998f`](https://github.com/spencerbeggs/semver-effect/commit/b9e998fd27b2d8e6816c91afb7c491923fc56b9c) TSDoc comments across `errors/`, `schemas/`, `services/`, `layers/`, and `utils/` now conform to the API Extractor toolchain (proper release tags, resolved `tsdoc-*` warnings). No runtime behavior changes.

### Build System

* [`b9e998f`](https://github.com/spencerbeggs/semver-effect/commit/b9e998fd27b2d8e6816c91afb7c491923fc56b9c) Migrated `savvy.build.ts` to the `@savvy-web/bundler@^1.1.0` `build()` API, replacing the previous `defineBuild` / `runBuild` pair
* Added a sanctioned `ae-forgotten-export` suppression (matching the `_base` pattern) for the synthetic intermediate classes Effect's `Context.Tag` generates, which cannot themselves be exported or release-tagged
* The production build now completes with 0 API Extractor warnings and 0 errors

### Dependencies

* [`b9e998f`](https://github.com/spencerbeggs/semver-effect/commit/b9e998fd27b2d8e6816c91afb7c491923fc56b9c) | Dependency | Type | Action | From | To |
  \| -------------------------- | ------------- | ------- | ------ | --------------------- |
  \| @savvy-web/bundler | devDependency | updated | ^1.0.1 | ^1.1.0 |
  \| @vitest-agent/plugin | devDependency | updated | ^1.1.2 | ^1.1.3 |
  \| @types/node | devDependency | added | — | ^26.0.1 |
  \| @typescript/native-preview | devDependency | added | — | ^7.0.0-dev.20260630.1 |
  \| typescript | devDependency | added | — | ^6.0.3 |

## 0.2.1

### Tests

* [`4ef47a4`](https://github.com/spencerbeggs/semver-effect/commit/4ef47a4d842d92a25dfa3243eff90aa9ad9c8003) Align with new test harness

## 0.2.0

### Breaking Changes

* [`4251082`](https://github.com/spencerbeggs/semver-effect/commit/425108213ede4d2a0ce2158fcf3dbc590b9cd4e5) **Schema.TaggedClass**: SemVer, Comparator, Range, VersionDiff now use
  `Schema.TaggedClass` instead of `Data.TaggedClass` with split base pattern.
  No more `*Base` exports for schemas.
* **Class-based Context.Tag**: Services (SemVerParser, VersionCache,
  VersionFetcher) migrated from `Context.GenericTag` to class-based
  `Context.Tag` with fully-qualified identifiers.
* **Flat exports**: Namespace modules removed. All exports are flat from
  `index.ts`. Standalone dual-API functions remain for pipe composition.

### Features

* [`4251082`](https://github.com/spencerbeggs/semver-effect/commit/425108213ede4d2a0ce2158fcf3dbc590b9cd4e5) **Instance methods**: SemVer has `compare()`, `gt()`, `gte()`, `lt()`,
  `lte()`, `eq()`, `neq()`, `isPrerelease`, `isStable`, and `bump.major()` /
  `bump.minor()` / `bump.patch()` / `bump.prerelease()` / `bump.release()`.
  Range has `test()` and `filter()`. Comparator has `test()`.
* **Static methods**: `SemVer.parse()`, `Range.parse()`, `Comparator.parse()`
  plus dual-API statics like `SemVer.compare()`, `Range.satisfies()`, etc.

### Other

* [`4251082`](https://github.com/spencerbeggs/semver-effect/commit/425108213ede4d2a0ce2158fcf3dbc590b9cd4e5) Clean build output: no `rslib-runtime.js` in dist.
* Closes #24

### Minor Changes

<!-- Pre-1.0 convention: minor bump for breaking changes (produces 0.2.0). -->

## 0.1.0

### Features

* [`badcb00`](https://github.com/spencerbeggs/semver-effect/commit/badcb00139b34a9b29132a9ef5225fba760a4741) Initial release of semver-effect: a strict SemVer 2.0.0 implementation built on Effect.

### Effect-Idiomatic Namespaced API

All operations are accessed through namespace modules, matching Effect's own conventions (`DateTime`, `Duration`, `Chunk`):

```typescript
import { SemVer, Range, Comparator } from "semver-effect";

const v = SemVer.make(1, 2, 3);
const next = SemVer.bump.minor(v); // 1.3.0
const parsed = yield * SemVer.fromString("2.0.0-rc.1");
const range = yield * Range.fromString("^2.0.0");
Range.satisfies(parsed, range); // true
```

### Core Types

* **`SemVer`** — Immutable `Data.TaggedClass` with structural equality and custom `toString`. Fields: `major`, `minor`, `patch`, `prerelease`, `build`.
* **`Comparator`** — Operator + version constraint (`>=`, `<`, `=`, etc.).
* **`Range`** — OR-joined comparator sets with normalized `toString`.
* **`VersionDiff`** — Structured diff with `type`, numeric deltas, and `from`/`to` references.

### Parsing

Hand-written recursive descent parser (no regex). Supports caret (`^`), tilde (`~`), hyphen, X-range, and OR union syntax. All parsing returns typed errors through Effect's error channel.

* `SemVer.fromString` — Parse strict SemVer 2.0.0 strings.
* `Range.fromString` — Parse range expressions with full node-semver syntax.
* `Comparator.fromString` — Parse individual comparators.

### Comparison & Predicates

Full suite of dual (data-first and pipeable) comparison functions:

* `SemVer.compare`, `SemVer.equal`, `SemVer.gt`, `SemVer.gte`, `SemVer.lt`, `SemVer.lte`, `SemVer.neq`
* `SemVer.compareWithBuild` — Total ordering including build metadata.
* `SemVer.isPrerelease`, `SemVer.isStable` — Version predicates.
* `SemVer.sort`, `SemVer.rsort`, `SemVer.max`, `SemVer.min` — Collection operations.
* `SemVer.truncate` — Strip prerelease or build metadata.

### Bumping

Grouped under `SemVer.bump.*`:

* `SemVer.bump.major`, `SemVer.bump.minor`, `SemVer.bump.patch`
* `SemVer.bump.prerelease` — With optional named identifier.
* `SemVer.bump.release` — Strip prerelease and build metadata.

### Range Matching

* `Range.satisfies` — Check if a version satisfies a range (dual).
* `Range.filter` — Filter version arrays against a range (dual).
* `Range.maxSatisfying`, `Range.minSatisfying` — Find best match (returns `Option`).

### Range Algebra

* `Range.union` — OR combination of ranges.
* `Range.intersect` — AND combination (fails with `UnsatisfiableConstraintError`).
* `Range.isSubset`, `Range.equivalent`, `Range.simplify` — Set-theoretic operations.

### Version Diffing

* `SemVer.diff` — Structured diff with `type` classification and signed numeric deltas.

### Convenience Constructors & Constants

* `SemVer.make(major, minor, patch, prerelease?, build?)` — Create versions without `new`.
* `SemVer.ZERO` — The `0.0.0` constant.
* `Range.any`, `Comparator.any` — Match any version.

### Effect Integration

* **`SemVer.Order`** — `Order<SemVer>` instance for sorted collections.
* **`SemVer.OrderWithBuild`** — `Order<SemVer>` including build metadata.
* **`SemVer.Equivalence`** — `Equivalence<SemVer>` instance.
* **Schema transforms** — `SemVer.FromString`, `Range.FromString`, `Comparator.FromString` for `Schema.decodeUnknown` pipelines. `SemVer.Instance`, `Range.Instance`, `Comparator.Instance` for runtime type validation.

### Services & Layers

* **`SemVerParser`** — Parsing service for dependency injection and testability.
* **`SemVerParserLive`** — Live layer implementation.
* **`VersionCache`** — Stateful version cache with resolution, grouping, and navigation.
* **`VersionCacheLive`** — Live layer backed by `Ref<SortedSet>`.
* **`VersionFetcher`** — Interface for external version sources (user-implemented).

### Typed Errors

All errors extend `Data.TaggedError` for `Effect.catchTag` matching:

`InvalidVersionError`, `InvalidRangeError`, `InvalidComparatorError`, `InvalidPrereleaseError`, `InvalidBumpError`, `UnsatisfiedRangeError`, `UnsatisfiableConstraintError`, `EmptyCacheError`, `VersionNotFoundError`, `VersionFetchError`.

### Strict Compliance

Only SemVer 2.0.0 is supported. No loose parsing, no v-prefix coercion, no node-semver compatibility hacks. 694 tests verify full spec compliance.
