---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 95
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

- Backed by a single `Ref<SortedSet<SemVer>>` for O(log n) operations
- Exposed as an Effect service via GenericTag + Layer pattern
- Every method returns an `Effect` with a typed error channel
- Read-heavy API: most operations query the set without modifying it
- Mutation methods are infallible; query/resolution methods surface typed errors

**Service interface + tag:** `src/services/VersionCache.ts`
**Layer implementation:** `src/layers/VersionCacheLive.ts`

---

## Current State

The VersionCache service is fully implemented and tested. All mutation, query,
resolution, grouping, and navigation methods are working.

---

## Rationale

### Why a Dedicated Service?

1. **Dependency injection.** Consumers declare `VersionCache` in their Effect
   requirements and receive an instance through the Layer system.
2. **Multiple instances.** The Effect service model supports independent caches.
3. **Testability.** Tests provide pre-populated Layers.
4. **Composability.** Methods return Effects that compose with other pipelines.

### Why `Ref<SortedSet<SemVer>>`?

SemVer ordering is central to every query. SortedSet provides O(log n)
insert/remove/lookup with guaranteed order, immutable snapshots on read,
and structural sharing on update. The read-heavy access pattern makes
pre-sorted storage the better trade-off over hash sets + sort-on-demand.

### Why Infallible Mutation?

`load`, `add`, and `remove` return `Effect<void, never>`. Adding a version
that already exists is a no-op (set semantics). Removing a version that
does not exist is a no-op. Loading replaces the entire set. Errors are
concentrated in query and resolution methods.

---

## Service API

### Mutation

Methods that modify the internal version set. All return
`Effect<void, never>`.

#### load(versions)

```text
load(versions: ReadonlyArray<SemVer>): Effect<void, never>
```

Replaces the entire cache with the provided versions. Internally calls
`Ref.set` with a new `SortedSet` built from the input using
`SortedSet.fromIterable`.

#### add(version)

```text
add(version: SemVer): Effect<void, never>
```

Inserts a single version. If already present, cache is unchanged.
Uses `Ref.update` with `SortedSet.add`.

#### remove(version)

```text
remove(version: SemVer): Effect<void, never>
```

Removes a single version. If not present, cache is unchanged.
Uses `Ref.update` with `SortedSet.remove`.

### Query

Methods that read the version set. Require non-empty cache.

#### versions

```text
versions: Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns all cached versions in ascending SemVer order. Fails with
`EmptyCacheError` if empty. Property-style accessor.

#### latest()

```text
latest(): Effect<SemVer, EmptyCacheError>
```

Returns the highest version (last element of sorted array).

#### oldest()

```text
oldest(): Effect<SemVer, EmptyCacheError>
```

Returns the lowest version (first element of sorted array).

### Resolution

Methods that match ranges against the cached version set.

#### resolve(range)

```text
resolve(range: Range): Effect<SemVer, UnsatisfiedRangeError>
```

Returns the highest cached version satisfying the range. Iterates from
the end of the sorted array (highest first). Fails with
`UnsatisfiedRangeError` if no match, including the range and available
versions in the error.

#### resolveString(input)

```text
resolveString(input: string): Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError>
```

Parses a range string and resolves in one step. The `SemVerParser`
dependency is captured at Layer construction time, keeping the method's
return type free of an `R` channel.

#### filter(range)

```text
filter(range: Range): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns all matching versions in ascending order. Fails with
`EmptyCacheError` only if the cache itself is empty. An empty match
result (no versions satisfy the range) returns an empty array, not an error.

### Grouping

Methods that partition the cached version set.

#### groupBy(strategy)

```text
groupBy(strategy: "major" | "minor" | "patch"):
  Effect<Map<string, ReadonlyArray<SemVer>>, EmptyCacheError>
```

Groups by the specified level. Keys are stringified group identifiers
(`"1"`, `"1.2"`, `"1.2.3"`). Values are sorted ascending.

#### latestByMajor()

```text
latestByMajor(): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns the highest version for each major version line. Implementation
iterates the sorted array, keeping the last seen version per major.

#### latestByMinor()

```text
latestByMinor(): Effect<ReadonlyArray<SemVer>, EmptyCacheError>
```

Returns the highest version for each major.minor version line.

### Navigation

Methods that locate a version's neighbors. Require the target version to
exist in the cache.

#### diff(a, b)

```text
diff(a: SemVer, b: SemVer): Effect<VersionDiff, VersionNotFoundError>
```

Computes structured diff. Verifies both versions exist via `SortedSet.has`.
Delegates to the pure `diff` utility function.

#### next(version)

```text
next(version: SemVer): Effect<Option<SemVer>, VersionNotFoundError>
```

Returns the next higher version, or `Option.none()` if highest. Finds
the version's index in the sorted array using `SemVerOrder`.

#### prev(version)

```text
prev(version: SemVer): Effect<Option<SemVer>, VersionNotFoundError>
```

Returns the next lower version, or `Option.none()` if lowest.

---

## VersionFetcher Interface

### Purpose

`VersionFetcher` is an abstract service interface for populating a
VersionCache from external sources. This library defines the interface only --
no concrete implementations are provided. Consumers implement the interface
and provide their own Layer.

### Interface

```typescript
interface VersionFetcher {
  readonly fetch: (
    packageName: string
  ) => Effect<ReadonlyArray<SemVer>, VersionFetchError>
}
export const VersionFetcher = Context.GenericTag<VersionFetcher>("VersionFetcher")
```

**File:** `src/services/VersionFetcher.ts`

### VersionFetchError

```typescript
class VersionFetchError extends Data.TaggedError("VersionFetchError")<{
  readonly source: string
  readonly message: string
  readonly cause?: unknown
}>
```

**File:** `src/errors/VersionFetchError.ts`

Generic enough for any source. The `source` field identifies where the
fetch was attempted, `cause` wraps the underlying transport error.

### Integration Pattern

1. Consumer provides `VersionFetcherLive` (their implementation)
2. Call `fetcher.fetch(packageName)` to get versions
3. Call `cache.load(versions)` to populate the cache
4. Use cache query/resolution methods

---

## Internal State Management

### Ref and SortedSet

```text
VersionCache (service)
  +-- Ref<SortedSet<SemVer>>    (mutable reference to immutable set)
         +-- SemVerOrder         (SemVer 2.0.0 precedence)
```

Key properties:

- **Immutable snapshots.** Every `Ref.get` returns an immutable SortedSet.
- **Structural sharing.** `SortedSet.add` and `SortedSet.remove` share nodes.
- **Single source of truth.** All methods read from/write to the same Ref.
- **Conversion to array:** `Array.from(SortedSet.values(set))` is used for
  iteration-based operations.

### Layer Implementation

```typescript
export const VersionCacheLive: Layer.Layer<VersionCache, never, SemVerParser> =
  Layer.effect(VersionCache, Effect.gen(function* () {
    const parser = yield* SemVerParser;  // Captured at construction
    const ref = yield* Ref.make(SortedSet.empty<SemVer>(SemVerOrder));
    return VersionCache.of({ /* methods close over ref and parser */ });
  }));
```

The Layer requires `SemVerParser` because `resolveString` needs to parse
range strings. The parser is captured in the outer generator closure, so
individual methods have no `R` channel.

### SortedSet Deduplication

Because Equal ignores build metadata, SortedSet treats `1.0.0+build1` and
`1.0.0+build2` as the same element ("first in wins"). This is correct per
the SemVer spec.

---

## Concurrency Model

### Ref Guarantees

`Ref` provides atomic compare-and-swap. Two concurrent `add` calls both
succeed. A `load` concurrent with an `add` has last-writer-wins semantics.
Read operations always see a consistent snapshot.

### No Locking Required

`Ref` uses immutable values internally. No explicit locks or mutexes needed.

### Consistency Across Multiple Reads

A single method call operates on one `Ref.get` snapshot. Cross-method
consistency requires the caller to read `versions` once and derive both
results from the same array.

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture
- [data-model.md](data-model.md) -- SemVer, Range, VersionDiff types
- [error-model.md](error-model.md) -- Error hierarchy
- [operations.md](operations.md) -- Pure comparison and matching functions

---

**Document Status:** Current -- covers the complete VersionCache service
implementation including all mutation, query, resolution, grouping, and
navigation methods. All operations are tested.
