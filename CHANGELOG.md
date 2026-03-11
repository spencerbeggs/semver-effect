# semver-effect

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
