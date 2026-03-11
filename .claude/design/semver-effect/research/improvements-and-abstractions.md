# Improvements and Abstractions Research

Research into potential improvements, new abstractions, and ecosystem integration
ideas for the semver-effect library. Covers VersionCache population services,
constraint solving, developer experience, performance, ecosystem integration,
API ergonomics, and alignment with filed GitHub issues.

**Date:** 2026-03-10
**Status:** Research output (not a design doc)

---

## Table of Contents

1. [GitHub Issues Summary](#github-issues-summary)
2. [VersionCache Population Services](#versioncache-population-services)
3. [Version Constraint Solving](#version-constraint-solving)
4. [Developer Experience Improvements](#developer-experience-improvements)
5. [Performance Optimizations](#performance-optimizations)
6. [Ecosystem Integration Ideas](#ecosystem-integration-ideas)
7. [API Ergonomics](#api-ergonomics)
8. [Lessons from Other Libraries](#lessons-from-other-libraries)
9. [Prioritized Recommendations](#prioritized-recommendations)
10. [Sources](#sources)

---

## GitHub Issues Summary

There are currently 9 open issues (no closed issues) on the repository, all
filed on 2026-03-10. They cover the full Phase 1 implementation plan:

| # | Title | Labels | Alignment |
| :-- | :------ | :------- | :---------- |
| 1 | Project scaffolding and build setup | infra | Foundation work |
| 2 | Port node-semver test suite for TDD | testing | TDD foundation |
| 3 | Error model: TaggedError types | data-model | Core infrastructure |
| 4 | SemVer data type: Schema.TaggedClass | data-model | Core data model |
| 5 | Comparator and Range data types | data-model | Core data model |
| 6 | SemVerParser: recursive descent parser | parser | Core parsing |
| 7 | Core comparison and sorting operations | operations | Core operations |
| 8 | Range matching and algebra operations | operations | Range algebra |
| 9 | VersionCache service | service | Cache service |

**Key observations:**

- All issues focus on Phase 1 (core implementation). No issues exist yet for
  Phase 2 (range algebra details) or Phase 3 (superset features).
- Issue #9 (VersionCache) defines the service interface but does not mention
  external population sources, TTL, or staleness -- these are opportunities
  for the ideas explored below.
- Issue #8 (Range matching and algebra) covers intersect/union/simplify/subset
  but does not mention multi-package constraint solving or explanation traces.
- No issues exist for developer experience features (branded types, template
  literals, Schema integration) or ecosystem integration (Effect Platform,
  package.json parsing, monorepo tooling).

The ideas in this research document are additive to the existing issue set and
would represent Phase 2+ work.

---

## VersionCache Population Services

The current design treats VersionCache as a container that consumers populate
manually via `load()` and `add()`. This section explores services that
automatically populate a VersionCache from external sources.

### A. Generic Fetcher Interface

Define a `VersionFetcher` service interface that any source can implement:

```text
interface VersionFetcher {
  readonly fetch: (
    package: string
  ) => Effect<ReadonlyArray<SemVer>, VersionFetchError, HttpClient>
}
```

This follows the same Tag + Layer pattern as SemVerParser and VersionCache.
Users provide a Layer for their source (npm, GitHub, custom registry), and the
fetcher composes with VersionCache via a higher-level "populate" operation:

```text
// Conceptual composition
const populateCache = (pkg: string) =>
  Effect.gen(function* () {
    const fetcher = yield* VersionFetcher
    const cache = yield* VersionCache
    const versions = yield* fetcher.fetch(pkg)
    yield* cache.load(versions)
  })
```

**Why a generic interface first:** It establishes the contract before any
concrete implementation. Users with private registries or custom sources can
implement VersionFetcher without depending on our npm/GitHub-specific code.

### B. npm Registry Fetcher

The npm registry exposes a REST API at `https://registry.npmjs.org/<package>`.
The response contains a `versions` object keyed by version string. A focused
query using the `?fields=versions` parameter reduces payload size significantly
for packages with hundreds of versions.

**Design sketch:**

```text
NpmRegistryFetcher: Layer<VersionFetcher, never, HttpClient>

// Configuration via a service
NpmRegistryConfig {
  registryUrl: string       // default: "https://registry.npmjs.org"
  scopeAuth?: Map<string, string>  // scoped auth tokens
}
```

**Effect Platform integration:** Use `@effect/platform`'s `HttpClient` service
so that the fetcher works across Node.js, Bun, and browser runtimes without
any fetch polyfill logic. The Layer dependency on `HttpClient` makes the
runtime injectable:

```text
// Node.js
NpmRegistryFetcherLive.pipe(Layer.provide(NodeHttpClient.layer))

// Bun
NpmRegistryFetcherLive.pipe(Layer.provide(BunHttpClient.layer))
```

**Schema validation:** Validate the registry response using Effect Schema to
produce typed errors if the API returns unexpected data. Define a schema for
the subset of the npm packument we need:

```text
const NpmVersionsResponse = Schema.Struct({
  versions: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
```

### C. GitHub Releases Fetcher

GitHub releases use the REST API at
`https://api.github.com/repos/{owner}/{repo}/releases`. Each release has a
`tag_name` field that typically contains a version string (often with a `v`
prefix that must be stripped).

**Design sketch:**

```text
GitHubReleasesFetcher: Layer<VersionFetcher, never, HttpClient>

GitHubReleasesConfig {
  owner: string
  repo: string
  tagPrefix: string     // default: "v", stripped before parsing
  auth?: string         // GitHub token for private repos
  includePrerelease: boolean  // whether to include draft/prerelease releases
}
```

**Tag-to-version mapping:** Since GitHub tags are not guaranteed to be valid
semver, the fetcher should use the SemVerParser service to parse each tag and
collect only the ones that parse successfully, logging or collecting failures
separately rather than failing the entire fetch.

### D. Caching Strategies

Population services should support caching to avoid repeated network calls:

**TTL-based caching:**

```text
CachedVersionFetcher {
  ttl: Duration               // how long fetched data is considered fresh
  staleness: Duration         // how long stale data is acceptable (serve-stale)
}
```

Implementation with Effect:

- Use `Ref<Option<{ fetchedAt: number; versions: ReadonlyArray<SemVer> }>>` to
  track the last fetch
- On `fetch()`, check if cached data exists and is within TTL; if so, return it
- If stale but within staleness window, return stale data and trigger background
  refresh via `Effect.fork`
- Use `Effect.cached` or `Effect.cachedWithTTL` from Effect's standard library
  as a simpler alternative for basic cases

**Effect.cachedWithTTL integration:**

```text
const cachedFetch = Effect.cachedWithTTL(
  fetcher.fetch(packageName),
  Duration.minutes(5)
)
```

This is the simplest approach and leverages Effect's built-in TTL caching. For
more control (stale-while-revalidate, per-package TTL), a custom Ref-based
approach is better.

**Invalidation:** Provide an explicit `invalidate()` method on the cached
fetcher so consumers can force a refresh (e.g., after publishing a new version).

### E. Layer Composition Pattern

The full stack composes naturally:

```text
// Build the full populated cache
const PopulatedCacheLive = Layer.mergeAll(
  VersionCacheLive,
  NpmRegistryFetcherLive,
  SemVerParserLive,
).pipe(
  Layer.provide(NpmRegistryConfigLive),
  Layer.provide(NodeHttpClient.layer),
)
```

Consumers just provide the top-level Layer and get a VersionCache already
populated with versions from npm.

---

## Version Constraint Solving

The current design covers range intersection (Phase 2) but does not address
multi-package constraint resolution. This section explores deeper constraint
solving capabilities.

### A. Multi-Package Constraint Resolution

Real-world dependency resolution requires satisfying constraints from multiple
packages simultaneously. For example: package A requires `foo@^1.2.0`, package
B requires `foo@~1.3.0`, and package C requires `foo@>=1.2.5 <1.4.0`. The
solver must find a single version of `foo` that satisfies all three.

**PubGrub algorithm:** The PubGrub algorithm (created by Natalie Weizenbaum
for Dart's pub package manager) is the state of the art for dependency
resolution. It uses conflict-driven clause learning (CDCL) to:

1. Maintain a set of incompatibilities (known conflicts)
2. Use unit propagation to narrow the search space
3. When a dead end is hit, derive a new incompatibility that prunes future
   search and records the reason for the conflict
4. Produce human-readable error explanations

**Scope for semver-effect:** A full PubGrub implementation is a substantial
undertaking and may be out of scope for the core library. However, a simpler
multi-range intersection with conflict detection is feasible and useful:

```text
ConstraintSet {
  constraints: Map<string, ReadonlyArray<Range>>  // package name -> ranges
}

ConstraintSolver {
  solve(
    constraints: ConstraintSet,
    available: Map<string, VersionCache>
  ): Effect<Map<string, SemVer>, ConstraintConflictError>
}
```

This would be a "single-package-at-a-time" solver: for each package, intersect
all its ranges and find the best match from the available versions. It does not
handle cross-package dependency graphs but handles the common case of multiple
consumers of the same package.

### B. Constraint Conflict Detection and Reporting

When constraints conflict, the error should explain why:

```text
ConstraintConflictError {
  _tag: "ConstraintConflictError"
  package: string
  constraints: ReadonlyArray<{ source: string; range: Range }>
  narrowedRange: Option<Range>  // the intersection, if partially satisfiable
  closest: Option<SemVer>       // nearest version that almost matched
}
```

**"Closest match" heuristic:** When no version satisfies the intersection,
identify the version that satisfies the most constraints (or misses by the
smallest margin). This helps users understand which constraint to relax.

### C. Explanation Traces

"Why was this version chosen?" is a common question. An explanation trace
records which constraints were active and how they narrowed the candidate set:

```text
ResolutionTrace {
  package: string
  resolved: SemVer
  steps: ReadonlyArray<{
    constraint: Range
    source: string
    remainingCandidates: number
  }>
}
```

Implementation: during resolution, maintain a running log of each constraint
applied and how many candidates remained after filtering. This is cheap (just
counting) and provides a clear narrative:

```text
Resolving foo:
  1. ^1.2.0 (from package A) -> 45 candidates remain
  2. ~1.3.0 (from package B) -> 12 candidates remain
  3. >=1.2.5 <1.4.0 (from package C) -> 8 candidates remain
  -> Selected: 1.3.7 (highest satisfying)
```

This composes well with Effect's logging/tracing capabilities. Each step can
be emitted as a span or log entry.

---

## Developer Experience Improvements

### A. Template Literal Types for Compile-Time Validation

TypeScript's template literal types can validate version string formats at
compile time:

```typescript
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type NumericString = `${Digit}` | `${Digit}${Digit}` | `${Digit}${Digit}${Digit}`
type SemVerString = `${NumericString}.${NumericString}.${NumericString}`

function parseVersion<S extends SemVerString>(input: S): Effect<SemVer, InvalidVersionError>
```

**Limitations:**

- Combinatorial explosion: three unions of 10+ members create thousands of
  types, potentially slowing the compiler significantly
- Cannot validate semantic rules (no leading zeros, valid prerelease) at the
  type level
- Prerelease and build metadata make the type even more complex

**Recommendation:** Provide a *basic* template literal overload that catches
obviously wrong strings (non-numeric, missing dots) but keep the primary API
accepting `string`. This gives a DX improvement without compiler performance
issues. The overload serves as a hint, not a gate:

```typescript
// Overload 1: compile-time hint for string literals
function parseVersion<S extends `${number}.${number}.${number}${string}`>(
  input: S
): Effect<SemVer, InvalidVersionError>

// Overload 2: general case for dynamic strings
function parseVersion(input: string): Effect<SemVer, InvalidVersionError>
```

### B. Branded Types for Validated Versions

Use Effect's `Brand` module to distinguish validated version strings from raw
strings at the type level:

```typescript
import { Brand } from "effect"

type ValidSemVerString = string & Brand.Brand<"ValidSemVerString">
type ValidRangeString = string & Brand.Brand<"ValidRangeString">
```

The SemVerParser would return branded strings alongside the parsed objects:

```typescript
interface SemVerParser {
  parseVersion(input: string): Effect<SemVer, InvalidVersionError>
  validateVersion(input: string): Effect<ValidSemVerString, InvalidVersionError>
}
```

**Use case:** APIs that accept version strings (like a REST endpoint) can use
`ValidSemVerString` in their type signatures to indicate that the string has
been validated. This prevents passing raw user input where a validated string
is expected.

**Integration with Schema:**

```typescript
const ValidSemVerStringSchema = Schema.String.pipe(
  Schema.brand("ValidSemVerString")
)
```

This gives both runtime validation (via Schema.decode) and compile-time
branding in a single declaration.

### C. Effect Schema Integration for Config Parsing

Many applications read version constraints from configuration files
(package.json, config files, YAML). Effect Schema can validate these:

```typescript
const DependencyMap = Schema.Record({
  key: Schema.String,
  value: Schema.String.pipe(
    Schema.filter((s) => /* validate as range */),
    Schema.brand("ValidRangeString")
  )
})

const PackageJsonDeps = Schema.Struct({
  dependencies: Schema.optional(DependencyMap),
  devDependencies: Schema.optional(DependencyMap),
  peerDependencies: Schema.optional(DependencyMap),
})
```

This would be a separate export/module (`semver-effect/schema`) that users
opt into, keeping the core package lean.

### D. Pretty-Printing for Ranges and Errors

Provide formatted output for diagnostics:

**Range pretty-printing:**

```text
Range: (>=1.2.3 AND <2.0.0) OR (>=3.0.0)
  Set 1: >=1.2.3 AND <2.0.0   (caret ~= ^1.2.3)
  Set 2: >=3.0.0               (open upper bound)
```

Annotating desugared ranges with their original sugar form (when known) helps
users understand what they wrote vs. what it means.

**Error pretty-printing with caret indicators:**

```text
InvalidVersionError: Expected numeric patch version
  Input: 1.2.abc
              ^^^
  Position: 4
```

This is straightforward to implement given the error model already carries
`input` and `position`. A `prettyPrint(error): string` function in a utility
module would handle the formatting.

---

## Performance Optimizations

### A. Lazy Parsing / Interning for Repeated Version Strings

In large dependency graphs, the same version string may appear dozens of times
(e.g., `^1.0.0` in many package.json files). Parsing it repeatedly is wasteful.

**String interning with WeakMap:**

```typescript
const internCache = new Map<string, SemVer>()

const internedParseVersion = (input: string): Effect<SemVer, InvalidVersionError> =>
  Effect.sync(() => internCache.get(input)).pipe(
    Effect.flatMap(Option.match({
      onSome: Effect.succeed,
      onNone: () => parser.parseVersion(input).pipe(
        Effect.tap((v) => Effect.sync(() => internCache.set(input, v)))
      )
    }))
  )
```

**Consideration:** This should be opt-in (a `CachedSemVerParser` layer) rather
than default, because the cache grows unboundedly for dynamic inputs. A
bounded LRU cache (Effect's `Cache` service) is more appropriate:

```text
CachedSemVerParserLive: Layer<SemVerParser, never, SemVerParser>

// Uses Effect.cache internally
const cachedParse = Effect.cached(parser.parseVersion(input))
```

Effect provides `Cache.make` with configurable capacity and TTL, which is
ideal here.

### B. Efficient Range Intersection Algorithms

The current design computes intersection via cross-product of ComparatorSets.
For ranges with many sets, this is O(n*m). Optimizations:

1. **Early pruning:** Before computing the full cross-product, check whether
   the overall bounds of two ranges overlap at all. If range A's maximum lower
   bound exceeds range B's minimum upper bound, they cannot intersect.

2. **Interval tree representation:** For large caches, represent each
   ComparatorSet as an interval [lower, upper) and use an interval tree for
   O(log n + k) intersection queries (where k is the number of overlapping
   intervals).

3. **Canonicalization:** Normalize ranges to a canonical form where each
   ComparatorSet has at most one lower bound and one upper bound. This reduces
   the combinatorics of intersection.

### C. SortedSet vs. Other Data Structures

The current design uses `SortedSet<SemVer>` (a balanced binary tree). This is
a good default but worth evaluating alternatives:

| Structure | Insert | Lookup | Range Query | Memory |
| :---------- | :------- | :------- | :------------ | :------- |
| SortedSet (RBTree) | O(log n) | O(log n) | O(log n + k) | High (nodes) |
| Sorted Array | O(n) | O(log n) | O(log n + k) | Low (contiguous) |
| B-Tree | O(log n) | O(log n) | O(log n + k) | Medium |

**Recommendation:** SortedSet is the right choice for the general case. For
read-heavy scenarios with rare mutations (the common case after initial
population), an immutable sorted array would be more cache-friendly. Consider
offering both via a configuration option on the VersionCache Layer.

**Snapshot optimization:** When `versions` is called, converting SortedSet to
an array is O(n). Cache this array and invalidate on mutation to avoid repeated
conversions in read-heavy workloads.

---

## Ecosystem Integration Ideas

### A. Effect Platform Integration

`@effect/platform` provides platform-agnostic abstractions for HTTP, file
system, and other I/O. Integrate with:

**HttpClient for registry fetches:**

- The VersionFetcher services (npm, GitHub) should depend on `HttpClient`
  from `@effect/platform`, not on a specific HTTP library
- This allows the same fetcher code to run on Node.js, Bun, or browser
  by swapping the platform Layer

**FileSystem for lockfile parsing:**

```text
LockfileVersionFetcher: Layer<VersionFetcher, never, FileSystem>

// Reads package-lock.json, pnpm-lock.yaml, or yarn.lock
// Extracts installed versions for a specific package
```

This enables offline VersionCache population from existing lockfiles.

### B. Package.json Schema for Effect Schema

A reusable Effect Schema for package.json that validates version fields:

```typescript
const PackageJson = Schema.Struct({
  name: Schema.String,
  version: SemVerStringSchema,  // validates as strict semver
  dependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: RangeStringSchema })
  ),
  devDependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: RangeStringSchema })
  ),
  peerDependencies: Schema.optional(
    Schema.Record({ key: Schema.String, value: RangeStringSchema })
  ),
  engines: Schema.optional(
    Schema.Struct({
      node: Schema.optional(RangeStringSchema),
      npm: Schema.optional(RangeStringSchema),
    })
  ),
})
```

This could be a separate package (`@spencerbeggs/package-json-schema`) or a
subpath export (`semver-effect/package-json`).

### C. Monorepo-Aware Version Querying

For monorepo tooling, provide utilities that understand workspace relationships:

```text
MonorepoVersionQuery {
  // Find all workspace packages and their versions
  discoverWorkspaces(root: string): Effect<Map<string, SemVer>, FileSystem>

  // Check cross-workspace version consistency
  checkConsistency(
    workspaces: Map<string, PackageJson>
  ): Effect<ReadonlyArray<ConsistencyIssue>, never>

  // Find which workspace packages satisfy a given range
  findSatisfying(
    range: Range,
    workspaces: Map<string, SemVer>
  ): ReadonlyArray<{ name: string; version: SemVer }>
}
```

This would use `@effect/platform`'s `FileSystem` to read workspace manifests
and the core semver-effect APIs for version operations.

---

## API Ergonomics

### A. Pipe-Friendly API Design

Effect's pipe model is the primary composition mechanism. Ensure all functions
work naturally in pipes:

```typescript
// Current (service method style)
const result = yield* cache.resolve(range)

// Also support dual API (data-last for piping)
const result = yield* pipe(
  range,
  VersionCache.resolve,
  Effect.provideService(VersionCache, cache)
)
```

Effect's `dual` function enables both calling conventions from a single
implementation:

```typescript
export const satisfies: {
  (range: Range): (version: SemVer) => boolean
  (version: SemVer, range: Range): boolean
} = dual(2, (version: SemVer, range: Range): boolean => /* ... */)
```

The pure operations (compare, satisfies, filter) are the best candidates for
dual APIs. Service methods (resolve, load) naturally live on the service
interface.

### B. Combinators for Complex Version Queries

Provide composable query builders for common patterns:

```typescript
// Find latest stable version in a major line
const latestStable = (major: number) =>
  pipe(
    Range.parse(`${major}.x`),
    Effect.flatMap((range) =>
      VersionCache.filter(range).pipe(
        Effect.map(Array.filter((v) => v.prerelease.length === 0)),
        Effect.map(Array.last),
        Effect.flatMap(Option.match({
          onNone: () => Effect.fail(new UnsatisfiedRangeError({ range, available: [] })),
          onSome: Effect.succeed,
        }))
      )
    )
  )

// Composable predicates
const isStable = (v: SemVer): boolean => v.prerelease.length === 0
const isMajor = (n: number) => (v: SemVer): boolean => v.major === n
const isNewerThan = (base: SemVer) => (v: SemVer): boolean => SemVer.gt(v, base)
```

These predicates compose with `Array.filter`, `Array.findFirst`, etc.

### C. Builder Pattern for Ranges

For programmatic range construction (rather than parsing from strings):

```typescript
const range = Range.builder()
  .gte(SemVer.make(1, 2, 0))
  .lt(SemVer.make(2, 0, 0))
  .or((b) => b.gte(SemVer.make(3, 0, 0)))
  .build()

// Equivalent to: ">=1.2.0 <2.0.0 || >=3.0.0"
```

This avoids string parsing when ranges are constructed programmatically and
provides type safety at construction time. The builder produces the same
Range data type as the parser.

**Alternative: factory functions:**

```typescript
const range = Range.union(
  Range.and(Comparator.gte(v1_2_0), Comparator.lt(v2_0_0)),
  Range.and(Comparator.gte(v3_0_0))
)
```

This is more functional and may fit the Effect style better than a mutable
builder. Both approaches produce the same output.

---

## Lessons from Other Libraries

### Rust's semver Crate (dtolnay/semver)

**Key takeaways:**

- `VersionReq` is the equivalent of our `Range`. It has a `matches(&self, version: &Version) -> bool` method that is the primary interface.
- Pre-release behavior is strict: `*` does not match pre-release versions
  unless the requirement explicitly contains a pre-release on the same
  major.minor.patch. Our design already follows this.
- The crate is focused and minimal: Version, VersionReq, Comparator, and
  error types. No cache, no fetching, no algebra. We can learn from this
  focus for our core module while adding the richer features as separate
  layers.
- Parsing errors include the position in the input string, validating our
  design choice.

### Deno std/semver

**Key takeaways:**

- Recently rewritten to use immutable plain objects for SemVer instances
  (similar to our Schema.TaggedClass approach but without the Effect
  integration).
- Provides `parse()` that returns an object and separate comparison functions
  (`lte`, `gte`, etc.) -- similar to our planned API.
- Has a `format()` function for string output and `increment()` for bumping.
- The deprecated API accepted raw strings everywhere; the new API requires
  parsed objects. This validates our decision to use parsed types throughout.
- Does not have range algebra, caching, or constraint solving.

### node-semver (npm/node-semver)

**Key takeaways (from issue #2 and general knowledge):**

- Has loose mode and coercion that we explicitly reject.
- Mutable SemVer class with methods -- we improve on this with immutable
  Schema.TaggedClass.
- No typed errors (returns null on parse failure) -- our Effect error channel
  is a significant improvement.
- Range algebra is limited to satisfies/filter/maxSatisfying -- our planned
  intersect/union/simplify goes beyond this.

### PubGrub (Dart/Rust implementations)

**Key takeaways for constraint solving:**

- The algorithm tracks incompatibilities as first-class data, which naturally
  produces explanation traces (answering "why was this version chosen?").
- A full PubGrub implementation requires a dependency provider interface that
  lazily fetches package metadata -- this aligns with our VersionFetcher
  concept.
- PubGrub's error reporting is its killer feature: it produces a derivation
  tree showing exactly which constraints conflicted and why.
- For semver-effect, a simplified version that handles single-package
  multi-constraint resolution (without cross-package dependencies) would
  capture most of the value at a fraction of the complexity.

---

## Prioritized Recommendations

### Tier 1: High Value, Moderate Effort (Phase 2)

1. **Branded types for validated strings** -- Small addition to the parser
   service that significantly improves type safety for consumers. Uses
   Effect's existing `Brand` module.

2. **Pretty-printing for errors** -- The error model already carries `input`
   and `position`. A `prettyPrint()` utility function is straightforward and
   immediately useful for CLI tools.

3. **Dual API for pure operations** -- Use Effect's `dual` to make comparison
   and matching functions work in both data-first and data-last styles. This
   is a convention improvement, not a new feature.

4. **Range builder / factory functions** -- Programmatic range construction
   avoids string round-tripping and provides better type safety.

### Tier 2: High Value, Higher Effort (Phase 3)

1. **npm Registry Fetcher** -- The most immediately useful population service.
   Depends on `@effect/platform` HttpClient. Should be a separate subpath
   export or package to keep the core lean.

2. **Cached parser (string interning)** -- Use Effect's `Cache` service to
   memoize repeated parses. Opt-in via a `CachedSemVerParser` Layer.

3. **Multi-range constraint resolution** -- Single-package constraint
   intersection with explanation traces. Does not require full PubGrub but
   provides the "why was this version chosen?" feature.

4. **Package.json Schema** -- Reusable Effect Schema for package.json
   version fields. Useful as a standalone utility.

### Tier 3: Exploratory (Phase 4+)

1. **GitHub Releases Fetcher** -- Similar to npm fetcher but for GitHub-based
   versioning workflows.

2. **Lockfile parsing** -- Read installed versions from package-lock.json,
    pnpm-lock.yaml, yarn.lock via Effect Platform FileSystem.

3. **Monorepo workspace querying** -- Higher-level tooling built on the core
    APIs and FileSystem.

4. **Full PubGrub constraint solver** -- Only if there is demand for
    cross-package dependency resolution. This is a major undertaking.

5. **Template literal type overloads** -- Nice-to-have DX improvement but
    with compiler performance risks. Keep simple (just `${number}.${number}.${number}${string}`)
    and do not attempt to validate prerelease/build at the type level.

---

## Sources

### TypeScript Semver Libraries

- [semver-ts - npm](https://www.npmjs.com/package/semver-ts)
- [ts-semver - GitHub](https://github.com/hediet/ts-semver)
- [Semantic Versioning for TypeScript Types](https://www.semver-ts.org/)

### Rust semver Crate

- [semver crate - docs.rs](https://docs.rs/semver)
- [VersionReq in semver - Rust](https://docs.rs/semver/latest/semver/struct.VersionReq.html)
- [SemVer Compatibility - The Cargo Book](https://doc.rust-lang.org/cargo/reference/semver.html)
- [SemVer in Rust: Tooling, Breakage, and Edge Cases - FOSDEM 2024](https://predr.ag/blog/semver-in-rust-tooling-breakage-and-edge-cases/)

### Deno std/semver

- [Deno std semver module](https://deno.land/std@0.182.0/semver/mod.ts)
- [deno-semver - GitHub](https://github.com/justjavac/deno-semver)

### Dependency Resolution Algorithms

- [PubGrub: Next-Generation Version Solving](https://nex3.medium.com/pubgrub-2fb6470504f)
- [Version SAT - research!rsc](https://research.swtch.com/version-sat)
- [Dependency Resolution Made Simple](https://borretti.me/article/dependency-resolution-made-simple)
- [PubGrub Resolver in uv](https://deepwiki.com/astral-sh/uv/3.1-pubgrub-resolver)
- [Dependency Resolution Methods](https://nesbitt.io/2026/02/06/dependency-resolution-methods.html)

### Effect-TS

- [Effect Platform HTTP Client](https://effect-ts.github.io/effect/platform/HttpClient.ts.html)
- [Effect Schema Advanced Usage](https://effect.website/docs/schema/advanced-usage/)
- [Effect Branded Types](https://effect.website/docs/code-style/branded-types/)
- [Effect Brand module](https://effect-ts.github.io/effect/effect/Brand.ts.html)

### TypeScript Patterns

- [TypeScript Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- [Branded Types - Learning TypeScript](https://www.learningtypescript.com/articles/branded-types)

### npm Registry API

- [Exploring the npm Registry API](https://www.edoardoscibona.com/exploring-the-npm-registry-api)
- [npm Registry API docs](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)
- [npm-registry-fetch](https://www.npmjs.com/package/npm-registry-fetch)
