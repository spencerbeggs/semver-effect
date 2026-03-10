---
status: draft
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 70
related:
  - architecture.md
  - data-model.md
  - operations.md
dependencies:
  - data-model.md
  - error-model.md
  - operations.md
---

# VersionCache Service

Queryable cache of known SemVer versions backed by `Ref<SortedSet<SemVer>>`,
exposed as an Effect service. Supports mutation, resolution, grouping, and
navigation over an ordered version set.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Service API](#service-api)
   - [Mutation](#mutation)
   - [Query](#query)
   - [Resolution](#resolution)
   - [Grouping](#grouping)
   - [Navigation](#navigation)
5. [VersionFetcher Interface](#versionfetcher-interface)
6. [Internal State Management](#internal-state-management)
7. [Concurrency Model](#concurrency-model)
8. [Related Documentation](#related-documentation)

---

## Overview

VersionCache is an Effect service that holds a sorted collection of SemVer
versions and exposes a rich query interface over that collection. It is the
primary integration point between parsed version data and higher-level
operations such as range resolution, version grouping, and ordered navigation.

**Key characteristics:**

- Backed by a single `Ref<SortedSet<SemVer>>` for O(log n) insert, remove,
  and lookup with guaranteed sort order
- Exposed as an Effect service via the Tag + make + Layer pattern, allowing
  multiple independent caches to coexist in the same application
- Every method returns an `Effect` with a typed error channel -- no exceptions,
  no null returns
- Read-heavy API: most operations query the set without modifying it
- Errors are scoped to the operation: mutation methods never fail, query methods
  surface `EmptyCacheError`, resolution methods surface range-specific errors,
  and the `VersionFetcher` interface surfaces `VersionFetchError`

**When to reference this document:**

- When implementing the service interface in `src/services/VersionCache.ts`
- When implementing the Layer in `src/layers/VersionCacheLive.ts`
- When designing tests for cache operations
- When integrating VersionCache with the parser service
- When reasoning about concurrency across cache operations

**Service interface + tag:** `src/services/VersionCache.ts`
**Layer implementation:** `src/layers/VersionCacheLive.ts`
**Schema types:** `src/schemas/` (SemVer, Range, Comparator, VersionDiff, etc.)
**Error types:** `src/errors/` (one error class per file)

---

## Current State

The project is in early implementation. The design spec is approved and the
VersionCache API surface is fully defined, but the module has not yet been
implemented.

### What Exists

- Approved design spec with the complete VersionCache method tree
- Architecture design doc describing VersionCache's role in the system
- Package scaffolding with placeholder source files

### What Remains

- Implementation of the VersionCache service interface in
  `src/services/VersionCache.ts` and its Layer in
  `src/layers/VersionCacheLive.ts`
- Implementation of all mutation, query, resolution, grouping, and navigation
  methods
- Implementation of the `VersionFetcher` interface and `VersionFetchError` type
  in `src/services/VersionFetcher.ts` and `src/errors/VersionFetchError.ts`
- Unit tests covering each method's success and error paths
- Integration tests combining VersionCache with the SemVerParser service

---

## Rationale

### Why a Dedicated Service?

Version caching could be handled as a plain data structure passed around by
the caller. A dedicated Effect service was chosen instead for several reasons:

1. **Dependency injection.** Consumers declare `VersionCache` in their Effect
   requirements and receive an instance through the Layer system. This avoids
   threading a mutable reference through function arguments.

2. **Multiple instances.** The Effect service model naturally supports multiple
   independent caches (e.g., one per package registry, one per lockfile) without
   any singleton coupling.

3. **Testability.** Tests can provide a pre-populated Layer without touching
   real data sources. The service boundary also makes it straightforward to
   create a test Layer with deterministic version sets.

4. **Composability.** VersionCache methods return Effects that compose with
   parser Effects, HTTP Effects, or any other Effect in the same pipeline.

### Why `Ref<SortedSet<SemVer>>`?

**Options considered:**

1. **`Ref<SortedSet<SemVer>>` (Chosen):**
   - Pros: O(log n) insert/remove/lookup, guaranteed order at all times,
     immutable snapshots on read, structural sharing on update
   - Cons: Slightly more memory than a mutable array
   - Why chosen: SemVer ordering is central to every query; maintaining a
     sorted structure eliminates repeated sorting

2. **`Ref<HashSet<SemVer>>` + sort on demand:**
   - Pros: O(1) amortized insert/remove
   - Cons: Every query that needs order (resolve, latest, oldest, next, prev,
     groupBy) must sort first -- O(n log n) per query
   - Why rejected: The read-heavy access pattern makes pre-sorted storage the
     better trade-off

3. **`Ref<ReadonlyArray<SemVer>>` with binary search:**
   - Pros: Cache-friendly layout, simple model
   - Cons: O(n) insert/remove due to array copying; no structural sharing
   - Why rejected: SortedSet provides the same lookup speed with cheaper
     mutation

### Why Infallible Mutation?

The `load`, `add`, and `remove` methods return `Effect<void, never>` -- they
cannot fail. This is a deliberate simplification:

- Adding a version that already exists is a no-op (set semantics).
- Removing a version that does not exist is a no-op (set semantics).
- Loading replaces the entire set; there is no invalid input because the
  caller provides already-parsed `SemVer` values.

Errors are concentrated in the query and resolution methods where meaningful
failure modes exist (empty cache, unsatisfied range, version not found).

---

## Service API

The full VersionCache interface is organized into five method groups.

### Mutation

Methods that modify the internal version set. All return
`Effect<void, never>` -- mutation cannot fail.

#### load(versions)

```text
load(versions: ReadonlyArray<SemVer>): Effect<void, never>
```

Replaces the entire cache contents with the provided versions. Any
previously cached versions are discarded. Internally calls `Ref.set` with
a new `SortedSet` built from the input.

Use case: initializing the cache from a registry response or lockfile.

#### add(version)

```text
add(version: SemVer): Effect<void, never>
```

Inserts a single version into the cache. If the version is already present
(per `Equal<SemVer>`), the cache is unchanged. Internally calls `Ref.update`
with `SortedSet.add`.

Use case: incrementally adding a newly published version.

#### remove(version)

```text
remove(version: SemVer): Effect<void, never>
```

Removes a single version from the cache. If the version is not present, the
cache is unchanged. Internally calls `Ref.update` with `SortedSet.remove`.

Use case: removing a yanked or retracted version.

### Query

Methods that read the version set without modifying it. Methods that require
a non-empty cache fail with `EmptyCacheError`.

#### versions

```text
versions: Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns all cached versions in ascending SemVer order. Fails with
`EmptyCacheError` if the cache is empty.

This is a property-style accessor (no parentheses) that reads from the Ref
and converts the SortedSet to a ReadonlyArray.

**Snapshot caching optimization:** The SortedSet-to-array conversion is O(n)
and could become a bottleneck in read-heavy workloads where `versions`,
`resolve`, or `filter` are called frequently between mutations. As an
optimization, the Layer implementation could cache the most recent array
conversion and invalidate it on any mutation (`load`, `add`, `remove`). This
avoids repeated O(n) conversions when the underlying set has not changed.
This optimization is not required for the initial implementation but should
be considered if profiling reveals hot paths.

#### latest()

```text
latest(): Effect<SemVer, EmptyCacheError>
```

Returns the highest version in the cache according to SemVer ordering.
Fails with `EmptyCacheError` if the cache is empty.

Implementation: reads the last element of the SortedSet.

#### oldest()

```text
oldest(): Effect<SemVer, EmptyCacheError>
```

Returns the lowest version in the cache according to SemVer ordering.
Fails with `EmptyCacheError` if the cache is empty.

Implementation: reads the first element of the SortedSet.

#### satisfies(version, range)

```text
satisfies(version: SemVer, range: Range): Effect<boolean, never>
```

Tests whether a single version satisfies a range. This is a pure predicate
that does not require the version to be in the cache. Returns `true` if
the version matches at least one ComparatorSet in the range, `false`
otherwise. Cannot fail.

### Resolution

Methods that match ranges against the cached version set.

#### resolve(range)

```text
resolve(range: Range): Effect<SemVer, UnsatisfiedRangeError>
```

Returns the highest cached version that satisfies the given range. Fails
with `UnsatisfiedRangeError` if no cached version matches.

Algorithm:

1. Read the SortedSet from the Ref.
2. Convert to array via `Array.from(SortedSet.values(set))`.
3. Iterate from the end of the array (highest first) to find the highest
   matching version.
4. Return the first version that satisfies the range.
5. If none found, fail with `UnsatisfiedRangeError` containing the range
   and the full list of available versions.

This is the primary resolution method and mirrors the behavior of
`npm`'s "best match" strategy.

**Reverse iteration approach:** SortedSet does not expose a native reverse
iterator. The recommended approach is to convert to an array with
`Array.from(SortedSet.values(set))` and then iterate from index
`length - 1` down to `0`. This is O(n) for the conversion plus O(k) for the
scan (where k is the number of elements checked before a match). The O(n)
conversion cost is incurred only on resolve calls, not on mutations.

#### resolveString(input)

```text
resolveString(input: string): Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError>
```

Convenience method that parses a range string and resolves it in one step.
Fails with `InvalidRangeError` if the string is not a valid range
expression, or `UnsatisfiedRangeError` if no cached version matches.

Implementation: calls `SemVerParser.parseRange(input)` then delegates to
`resolve`.

**Important: dependency capture at construction time.** The `SemVerParser`
dependency is captured in the `Layer.effect` closure when `VersionCacheLive`
is constructed, NOT in the `resolveString` method body. This keeps the
method's return type free of an `R` channel:

```typescript
export const VersionCacheLive = Layer.effect(
  VersionCache,
  Effect.gen(function* () {
    const parser = yield* SemVerParser  // Captured at construction
    const ref = yield* Ref.make(SortedSet.empty(SemVerOrder))
    return {
      resolveString: (input) => Effect.gen(function* () {
        const range = yield* parser.parseRange(input)
        // ... resolve from ref
      }),
      // ... other methods close over ref
    }
  })
)
// Type: Layer<VersionCache, never, SemVerParser>
```

Because `parser` is captured in the outer generator, `resolveString` returns
`Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError, never>` -- no `R`
channel. The `SemVerParser` requirement appears only in the Layer's input
(`R_in`), not in any method signature. This pattern applies to any service
method that needs an external dependency: capture it in the Layer closure,
not in the method body.

#### filter(range)

```text
filter(range: Range): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns all cached versions that satisfy the given range, in ascending
SemVer order. Fails with `EmptyCacheError` if the cache is empty.

Note: an empty result (no versions match) is returned as an empty array,
not as an error. The `EmptyCacheError` only fires when the cache itself
has no versions at all.

### Grouping

Methods that partition the cached version set by semantic criteria.

#### groupBy(strategy)

```text
groupBy(strategy: "major" | "minor" | "patch"):
  Effect<Map<string, ReadonlyArray<SemVer>>, EmptyCacheError>
```

Groups cached versions by the specified strategy. The map key is the
stringified group identifier.

Strategy behavior:

- `"major"`: key is `"1"`, `"2"`, etc. Groups all versions sharing the
  same major number.
- `"minor"`: key is `"1.2"`, `"1.3"`, etc. Groups all versions sharing
  the same major.minor pair.
- `"patch"`: key is `"1.2.3"`, `"1.2.4"`, etc. Groups all versions
  sharing the same major.minor.patch triple (differentiating only by
  prerelease).

Values within each group are sorted in ascending SemVer order.

Fails with `EmptyCacheError` if the cache is empty.

#### latestByMajor()

```text
latestByMajor(): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns the highest version for each major version line, sorted by major
number ascending.

Example: given `[1.0.0, 1.2.3, 2.0.0, 2.1.0, 3.0.0-beta.1]`, returns
`[1.2.3, 2.1.0, 3.0.0-beta.1]`.

Implementation: delegates to `groupBy("major")` and takes the last element
of each group.

#### latestByMinor()

```text
latestByMinor(): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns the highest version for each minor version line, sorted by
major.minor ascending.

Example: given `[1.0.0, 1.0.3, 1.1.0, 1.1.2, 2.0.0]`, returns
`[1.0.3, 1.1.2, 2.0.0]`.

Implementation: delegates to `groupBy("minor")` and takes the last element
of each group.

### Navigation

Methods that locate a version's neighbors in the sorted cache. Require the
target version to exist in the cache.

#### diff(a, b)

```text
diff(a: SemVer, b: SemVer): Effect<VersionDiff, VersionNotFoundError>
```

Computes a structured diff between two cached versions. Fails with
`VersionNotFoundError` if either version is not present in the cache.

The returned `VersionDiff` includes the diff type (`major`, `minor`,
`patch`, `prerelease`, `build`, `none`) and numeric deltas for major,
minor, and patch components.

#### next(version)

```text
next(version: SemVer): Effect<Option<SemVer>, VersionNotFoundError>
```

Returns the next higher version in the cache after the given version, or
`Option.none()` if the version is the highest. Fails with
`VersionNotFoundError` if the given version is not in the cache.

Implementation: locates the version in the SortedSet and reads the
immediately following element.

#### prev(version)

```text
prev(version: SemVer): Effect<Option<SemVer>, VersionNotFoundError>
```

Returns the next lower version in the cache before the given version, or
`Option.none()` if the version is the lowest. Fails with
`VersionNotFoundError` if the given version is not in the cache.

Implementation: locates the version in the SortedSet and reads the
immediately preceding element.

---

## VersionFetcher Interface

### Purpose

`VersionFetcher` is an abstract service interface for consumers who need to
populate a VersionCache from external sources (npm registries, GitHub
releases, local filesystems, etc.). This library defines the interface only
-- it does NOT provide concrete implementations. Consumers implement the
interface and provide their own Layer.

This is a deliberate design boundary: semver-effect is a low-level SemVer
library and should not take opinions on HTTP clients, file I/O, or registry
protocols. Concrete fetchers belong in consumer packages.

### Interface Definition

```typescript
interface VersionFetcher {
  readonly fetch: (
    packageName: string
  ) => Effect<ReadonlyArray<SemVer>, VersionFetchError>
}
export const VersionFetcher = Context.GenericTag<VersionFetcher>("VersionFetcher")
```

The `R` channel of `fetch` is intentionally `never`. Consumers capture their
HTTP, filesystem, or other dependencies in their Layer closure (the same
pattern described for `resolveString` above), keeping the method signature
clean. A consumer Layer might look like:

```typescript
const NpmFetcherLive = Layer.effect(
  VersionFetcher,
  Effect.gen(function* () {
    const http = yield* HttpClient  // Captured at construction
    return {
      fetch: (packageName) => Effect.gen(function* () {
        const response = yield* http.get(`https://registry.npmjs.org/${packageName}`)
        // parse response into ReadonlyArray<SemVer>
      }).pipe(Effect.mapError((e) => new VersionFetchError({ source: "npm", cause: e })))
    }
  })
)
// Type: Layer<VersionFetcher, never, HttpClient>
```

### VersionFetchError

A new error type for the fetcher interface, generic enough for any source:

```typescript
class VersionFetchError extends Data.TaggedError("VersionFetchError")<{
  readonly source: string       // e.g., "npm", "github", "filesystem"
  readonly message: string      // Human-readable description
  readonly cause?: unknown      // Underlying error
}> {}
```

`VersionFetchError` lives in `src/errors/VersionFetchError.ts` alongside the
other error types. It is intentionally generic: the `source` field identifies
where the fetch was attempted, and `cause` wraps the underlying transport or
parse error. Consumers who need more specific error types can extend or wrap
`VersionFetchError` in their own error hierarchy.

### Integration with VersionCache

A typical consumer workflow:

1. Provide `VersionFetcherLive` (their concrete implementation).
2. Call `fetcher.fetch(packageName)` to get versions.
3. Call `cache.load(versions)` to populate the cache.
4. Use cache query/resolution methods as needed.

This two-step pattern keeps VersionCache pure (it never performs I/O) and
gives consumers full control over when and how versions are fetched.

---

## Internal State Management

### `Ref<SortedSet<SemVer>>`

The VersionCache holds its state in a single `Ref<SortedSet<SemVer>>`. The
`SortedSet` is parameterized with `Order<SemVer>`, which implements the
SemVer 2.0.0 precedence rules (major > minor > patch > prerelease, build
metadata ignored for ordering).

```text
VersionCache (service)
  └── Ref<SortedSet<SemVer>>    (mutable reference to immutable set)
         └── Order<SemVer>      (SemVer 2.0.0 precedence)
```

**Key properties of this design:**

- **Immutable snapshots.** Every `Ref.get` returns an immutable
  `SortedSet`. Readers never observe partial updates.
- **Structural sharing.** `SortedSet.add` and `SortedSet.remove` produce
  new trees that share most nodes with the previous version, keeping
  allocation costs low.
- **Single source of truth.** All methods read from or write to the same
  Ref. There is no secondary index or denormalized state.

### Service Definition Pattern

The service follows Effect's Tag + make + Layer pattern, split across two
files:

**`src/services/VersionCache.ts`** -- interface and tag:

```text
1. Interface:  export interface VersionCache { readonly load: ...; ... }
2. Tag:        export const VersionCache = Context.GenericTag<VersionCache>("VersionCache")
```

The tag uses `Context.GenericTag` (not the `Context.Tag` class) to create
a service identifier that can be used in Effect's dependency injection
system.

**`src/layers/VersionCacheLive.ts`** -- live implementation:

```text
3. make:   Effect that creates a Ref<SortedSet<SemVer>> and returns the
           service object with all methods closed over that Ref
4. Layer:  Layer.effect(VersionCache, make)
```

The `make` Effect allocates the Ref with an empty SortedSet. Consumers
provide the Layer and then call `load` to populate the cache, or call `add`
incrementally.

### State Transitions

```text
Empty (initial)
  │
  ├── load(versions) ──> Populated
  ├── add(version)   ──> Populated (single version)
  │
Populated
  │
  ├── load(versions) ──> Populated (replaced)
  ├── add(version)   ──> Populated (grown)
  ├── remove(version)──> Populated or Empty
  │
  ├── versions / latest / oldest / ... ──> Success
  │
Empty (after remove of last version)
  │
  ├── versions / latest / oldest / ... ──> EmptyCacheError
```

---

## Concurrency Model

### Ref Guarantees

`Ref` provides atomic compare-and-swap semantics. Each call to `Ref.update`
or `Ref.set` is atomic with respect to other fiber-level operations on the
same Ref. This means:

- Two concurrent `add` calls will both succeed; the final set contains both
  versions.
- A `load` concurrent with an `add` has last-writer-wins semantics at the
  Ref level. If `load` commits after `add`, the added version is lost
  (replaced by the load set). This is acceptable because `load` is
  documented as a full replacement.
- Read operations (`versions`, `latest`, `resolve`, etc.) always see a
  consistent snapshot. They never observe a half-updated set.

### No Locking Required

Because `Ref` uses immutable values internally, there is no need for
explicit locks or mutexes. Fibers can read and write concurrently without
coordination beyond what `Ref` already provides.

### Consistency Across Multiple Reads

A single method call (e.g., `resolve`) performs one `Ref.get` and operates
on the returned snapshot. If the caller needs consistency across multiple
method calls (e.g., `latest()` followed by `filter(range)`), the caller
should read `versions` once and derive both results from the same array.
The service does not provide transaction boundaries across method calls.

### Fiber Safety

All VersionCache methods are fiber-safe. Multiple fibers can share a single
VersionCache instance and call any methods concurrently. The only caveat is
the lack of cross-method transaction guarantees noted above.

---

## Related Documentation

**Design Spec:**

- [semver-effect Design Spec](../../../docs/specs/semver-effect-design.md) --
  Approved specification with the full VersionCache method tree

**Architecture:**

- [architecture.md](architecture.md) -- System-level architecture and
  component relationships

**Dependencies (design docs to be created):**

- `data-model.md` -- SemVer, Range, Comparator, VersionDiff type definitions
  (schema types live in `src/schemas/`)
- `error-model.md` -- Error hierarchy and typed error channel design
  (error classes live in `src/errors/`, one per file)
- `operations.md` -- Pure comparison and range matching functions

---

**Document Status:** Draft -- covers the full VersionCache service API,
internal state management, and concurrency model based on the approved
design spec. Will be updated as implementation progresses.

**Next Steps:** Implement the service interface in
`src/services/VersionCache.ts` and the Layer in
`src/layers/VersionCacheLive.ts` following this design. Create companion
design docs for the data model and error model.
