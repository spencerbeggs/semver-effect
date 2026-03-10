---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: 2026-03-10
completeness: 75
related:
  - architecture.md
  - data-model.md
  - parser.md
dependencies:
  - data-model.md
  - error-model.md
---

# Semver Effect - Core Operations

Pure functions and effectful operations for comparing versions, matching
ranges, performing range algebra, and computing structured diffs.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Comparison Operations](#comparison-operations)
5. [Range Matching](#range-matching)
6. [Range Algebra](#range-algebra)
7. [Diffing](#diffing)
8. [Implementation Notes](#implementation-notes)
9. [Related Documentation](#related-documentation)

---

## Overview

This document covers the four categories of operations exposed by the
semver-effect package: comparison, range matching, range algebra, and diffing.
These operations sit above the data model and parser layers and provide the
primary user-facing functionality for working with semantic versions.

**Scope:**

- Comparison functions on SemVer instances (pure, no Effect wrapper)
- Range matching functions that test versions against Range instances
- Range algebra functions that combine, simplify, and relate ranges
- Diffing functions that compute structured deltas between versions

**Key Characteristics:**

- Comparison operations are pure functions with no error channel
- Range matching operations return plain values or Option types
- Range algebra operations return Effect where intersection can fail
- All operations work on the immutable data types defined in the data model

**Dual API Convention (data-first and data-last):**

All pure operations (compare, satisfies, filter, gt, lt, etc.) use Effect's
`dual` function to support both data-first and data-last calling conventions.
This is an Effect ecosystem convention and improves pipe ergonomics:

```typescript
export const satisfies: {
  (range: Range): (version: SemVer) => boolean
  (version: SemVer, range: Range): boolean
} = dual(2, (version: SemVer, range: Range): boolean => /* ... */)
```

Data-last form enables piping: `pipe(version, SemVer.gt(other))`.
Data-first form enables direct calls: `SemVer.gt(a, b)`.
All binary pure operations (comparison helpers, `satisfies`, `filter`,
`maxSatisfying`, `minSatisfying`, `isSubset`, `equivalent`) follow this
pattern.

**When to reference this document:**

- When implementing comparison, matching, algebra, or diff functions
- When deciding whether an operation should be pure or effectful
- When integrating SemVer ordering with Effect's collection utilities
- When designing range constraint solving logic

---

## Current State

The project is in early implementation. The design spec is approved and the
operations API surface is defined, but the operation modules have not yet been
implemented.

### Planned File Locations

- **Comparison:** `src/utils/compare.ts` (comparison functions + Order instance)
- **Range Matching:** `src/utils/matching.ts` (range matching logic)
- **Range Algebra:** `src/utils/algebra.ts` (range algebra returning Effect)
- **Diffing:** `src/utils/diff.ts` (diffing logic returning VersionDiff)
- **Schema Types:** `src/schemas/` (SemVer, Range, Comparator, VersionDiff)

### Implementation Status

| Operation Group | Status | Notes |
| :-------------- | :----- | :---- |
| Comparison | Not started | Pure functions, no Effect wrapper |
| Range Matching | Not started | Depends on Comparator matching logic |
| Range Algebra | Not started | Most complex; intersect needs solver |
| Diffing | Not started | Straightforward once data model exists |

---

## Rationale

### Why Pure Comparison Functions

Comparison operations (`compare`, `equal`, `gt`, `lt`, etc.) operate on
already-parsed SemVer instances. Since parsing has already validated the
input, these functions cannot fail and do not need Effect wrappers. Keeping
them pure enables direct use in Effect's `Array.sort`, `SortedSet`, and
other collection utilities that expect `Order<A>` or predicate functions.

### Why Range Matching Returns Plain Values

`Range.satisfies` returns a plain `boolean` because both the version and
range are already parsed and validated. `Range.maxSatisfying` and
`Range.minSatisfying` return `Option<SemVer>` rather than Effect because
"no match" is a normal outcome, not an error. This follows the Effect
convention of using Option for expected absence.

### Why Range Algebra Uses Effect

`Range.intersect` can fail when two ranges have no overlap -- this is a
genuine domain error (`UnsatisfiableConstraintError`), not an expected
absence. Wrapping the result in Effect allows callers to handle the error
through the typed error channel. `Range.union` and `Range.simplify` cannot
fail, so they return `Effect<Range, never>` for consistency within the
algebra API, and to allow future extension (for example, simplification
heuristics that may need context or services).

### Why Diffing Is Pure

`SemVer.diff` takes two valid SemVer instances and always produces a
VersionDiff. There is no failure case: even identical versions produce a
diff with type "none" and zero deltas.

---

## Comparison Operations

### API Surface

```text
SemVer.compare(a: SemVer, b: SemVer): -1 | 0 | 1
SemVer.equal(a: SemVer, b: SemVer): boolean
SemVer.gt(a: SemVer, b: SemVer): boolean
SemVer.gte(a: SemVer, b: SemVer): boolean
SemVer.lt(a: SemVer, b: SemVer): boolean
SemVer.lte(a: SemVer, b: SemVer): boolean
SemVer.neq(a: SemVer, b: SemVer): boolean
SemVer.isPrerelease(v: SemVer): boolean
SemVer.isStable(v: SemVer): boolean
SemVer.truncate(level: "prerelease" | "build", v: SemVer): SemVer
SemVer.sort(versions: Array<SemVer>): Array<SemVer>
SemVer.rsort(versions: Array<SemVer>): Array<SemVer>
SemVer.max(versions: Array<SemVer>): SemVer
SemVer.compareWithBuild(a: SemVer, b: SemVer): -1 | 0 | 1
SemVer.min(versions: Array<SemVer>): SemVer
```

### Comparator Helpers

`SemVer.isPrerelease(v)` returns `true` when `v.prerelease` is non-empty.
`SemVer.isStable(v)` returns `true` when `v.prerelease` is empty (i.e., the
version has no prerelease tag). Both are convenience predicates that compose
naturally with `Array.filter`:

```typescript
const stableOnly = versions.filter(SemVer.isStable)
const prereleases = versions.filter(SemVer.isPrerelease)
```

### Truncation

`SemVer.truncate(level, v)` strips metadata from a version and returns a new
SemVer instance:

- `SemVer.truncate("prerelease", v)` -- removes both prerelease and build
  metadata, returning `major.minor.patch` only.
- `SemVer.truncate("build", v)` -- removes build metadata only, preserving
  the prerelease tag.

This is a pure function using `dual` for data-first/data-last support:

```typescript
export const truncate: {
  (level: "prerelease" | "build"): (v: SemVer) => SemVer
  (level: "prerelease" | "build", v: SemVer): SemVer
} = dual(2, (level: "prerelease" | "build", v: SemVer): SemVer => /* ... */)
```

Use cases include normalizing versions before comparison, stripping CI
metadata for display, or producing clean release versions from prerelease
candidates.

### Ordering Rules (SemVer 2.0.0 Section 11)

Comparison follows the SemVer 2.0.0 specification precedence rules:

1. **Major, minor, patch** are compared numerically in that order.
2. **Prerelease** identifiers are compared left to right:
   - Numeric identifiers are compared as integers.
   - Alphanumeric identifiers are compared lexically (ASCII sort order).
   - Numeric identifiers always have lower precedence than alphanumeric.
   - A shorter prerelease array has lower precedence if all preceding
     identifiers are equal.
3. **A version with prerelease has lower precedence** than the same version
   without prerelease (e.g., `1.0.0-alpha < 1.0.0`).
4. **Build metadata is ignored** in all comparisons per the spec.

### Order Instance

The comparison logic is also exposed as an `Order<SemVer>` instance for
direct integration with Effect's collection utilities:

```typescript
import { Order as SemVerOrder } from "semver-effect/utils/compare"
import { Array, SortedSet } from "effect"

// Use with Array.sort
const sorted = Array.sort(versions, SemVerOrder)

// Use with SortedSet
const set = SortedSet.fromIterable(versions, SemVerOrder)
```

The `Order<SemVer>` instance is the single source of truth. `SemVer.compare`
delegates to it, and all relational helpers (`gt`, `gte`, `lt`, `lte`, `neq`)
are derived from `compare`.

### Build-Aware Comparison

The standard `SemVerOrder` ignores build metadata per the SemVer 2.0.0 spec.
For use cases where build metadata ordering matters (e.g., CI pipelines where
build numbers encode meaningful sequence), an opt-in build-aware comparison is
provided:

```text
SemVer.compareWithBuild(a: SemVer, b: SemVer): -1 | 0 | 1
```

`compareWithBuild` extends the standard comparison: it first applies the
normal SemVer precedence rules, and if the result is `0` (versions are equal
ignoring build), it performs a lexicographic comparison of the build metadata
arrays using the same identifier comparison rules as prerelease (numeric
identifiers compared as integers, alphanumeric compared lexically, numeric
sorts before alphanumeric, shorter arrays sort before longer when prefixes
match). A version with no build metadata sorts before a version with build
metadata when all other fields are equal.

This is also exposed as an `Order<SemVer>` instance:

```typescript
import { OrderWithBuild as SemVerOrderWithBuild } from "semver-effect/utils/compare"

// Deterministic sort even when versions differ only by build
const sorted = Array.sort(versions, SemVerOrderWithBuild)
```

**Note:** `SemVerOrderWithBuild` is strictly opt-in. The default `SemVerOrder`
and all relational helpers (`gt`, `lt`, etc.) continue to ignore build
metadata. `compareWithBuild` is a separate function, not a configuration
option on the standard comparison.

### Collection Helpers

`SemVer.sort` and `SemVer.rsort` are convenience wrappers around
`Array.sort` with the SemVer Order instance. They return new arrays and do
not mutate the input.

`SemVer.max` and `SemVer.min` iterate the array once using the Order to
find the extreme values. They assume a non-empty array; behavior on empty
input follows the same pattern as Effect's `Array.reduce`.

### Equality Semantics

`SemVer.equal` checks structural equality of major, minor, patch, and
prerelease fields. Build metadata is excluded per spec. This aligns with
the `Equal` trait implementation on the SemVer Schema.TaggedClass, so
`Equal.equals(a, b)` and `SemVer.equal(a, b)` always agree.

---

## Range Matching

### API Surface

```text
Range.satisfies(version: SemVer, range: Range): boolean
Range.filter(versions: Array<SemVer>, range: Range): Array<SemVer>
Range.maxSatisfying(versions: Array<SemVer>, range: Range): Option<SemVer>
Range.minSatisfying(versions: Array<SemVer>, range: Range): Option<SemVer>
```

### Matching Algorithm

A version satisfies a Range when it satisfies at least one ComparatorSet
in the Range (OR semantics). A version satisfies a ComparatorSet when it
satisfies every Comparator in the set (AND semantics).

A version satisfies a single Comparator by applying its operator:

| Operator | Condition |
| :------- | :-------- |
| `=` | `SemVer.equal(version, comparator.version)` |
| `>` | `SemVer.gt(version, comparator.version)` |
| `>=` | `SemVer.gte(version, comparator.version)` |
| `<` | `SemVer.lt(version, comparator.version)` |
| `<=` | `SemVer.lte(version, comparator.version)` |

### Prerelease Matching Behavior

**Important:** This is a node-semver convention, not a requirement of the
SemVer 2.0.0 specification itself. We adopt it for compatibility with the
npm ecosystem.

A prerelease version only satisfies a range comparator if the comparator's
version shares the same `[major, minor, patch]` tuple. This prevents
prereleases from "leaking" into ranges that were not explicitly written to
include them.

**Examples:**

- `3.0.0-beta.1` satisfies `>=3.0.0-alpha.1` -- same `[3, 0, 0]` tuple,
  and `beta.1 > alpha.1` by prerelease precedence.
- `3.0.0-beta.1` does NOT satisfy `>=2.9.0` -- even though
  `3.0.0-beta.1 > 2.9.0` by SemVer precedence, the comparator `>=2.9.0`
  has tuple `[2, 9, 0]` which does not match `[3, 0, 0]`.
- `1.0.0-rc.1` does NOT satisfy `>=0.9.0 <2.0.0` -- neither comparator
  in the set has tuple `[1, 0, 0]`.
- `1.0.0-rc.1` satisfies `>=1.0.0-alpha.1 <2.0.0` -- the first comparator
  has tuple `[1, 0, 0]` which matches.

The implementation checks: for each ComparatorSet, if the version is a
prerelease, at least one Comparator in that set must (a) have a non-empty
prerelease AND (b) share the same major.minor.patch. If no Comparator
qualifies, the set does not match the version.

### No `includePrerelease` Option

Unlike node-semver, we do **not** support an `includePrerelease` option that
relaxes the same-tuple prerelease matching policy. Our matching always follows
the strict rule: a prerelease version only matches a comparator whose version
shares the same `[major, minor, patch]` tuple. There is no opt-out.

This is a deliberate design choice for strictness. The `includePrerelease`
flag in node-semver is a source of subtle bugs -- callers forget to pass it,
or pass it inconsistently across different call sites, leading to ranges that
silently match (or exclude) prereleases in unexpected ways. By enforcing the
strict policy unconditionally, we eliminate an entire class of misconfiguration
errors. Callers who need to match prereleases across tuples can construct
explicit ranges that include the desired prerelease comparators.

### Filter and Select

`Range.filter` returns all versions from the input array that satisfy the
range, preserving the original order.

`Range.maxSatisfying` returns `Option.some(version)` for the highest
satisfying version (by SemVer precedence), or `Option.none()` if no version
matches.

`Range.minSatisfying` returns `Option.some(version)` for the lowest
satisfying version, or `Option.none()` if no version matches.

Both `maxSatisfying` and `minSatisfying` use the `Order<SemVer>` to
determine precedence among matching versions.

---

## Range Algebra

### API Surface

```text
Range.intersect(a: Range, b: Range): Effect<Range, UnsatisfiableConstraintError>
Range.union(a: Range, b: Range): Effect<Range, never>
Range.simplify(range: Range): Effect<Range, never>
Range.isSubset(sub: Range, sup: Range): boolean
Range.equivalent(a: Range, b: Range): boolean
```

### Intersection

`Range.intersect` computes the range that satisfies both `a` AND `b`. The
algorithm works at the ComparatorSet level:

1. For each pair `(setA, setB)` where `setA` is from `a` and `setB` is
   from `b`, merge the comparators into a candidate set.
2. Check each candidate set for internal consistency (e.g., `>=2.0.0` and
   `<1.0.0` in the same set is unsatisfiable).
3. Collect all satisfiable candidate sets into the result Range.
4. If no candidate sets are satisfiable, fail with
   `UnsatisfiableConstraintError`.

The error includes the `constraints` field listing both input ranges so
callers can report which ranges conflict.

### Union

`Range.union` computes the range that satisfies `a` OR `b`. Since Range
already has OR semantics across its ComparatorSets, union concatenates the
sets from both ranges. The error channel is `never` because union of any
two ranges is always representable.

The result may contain redundant sets. Callers can pipe through
`Range.simplify` to reduce the representation.

### Simplification

`Range.simplify` reduces a Range to a minimal equivalent form by:

1. Removing ComparatorSets that are strict subsets of another set in the
   same Range (since OR makes the superset sufficient).
2. Merging adjacent or overlapping ComparatorSets where possible.
3. Sorting sets into a canonical order for consistent string representation.

Simplification is best-effort: some ranges may not reduce further. The
error channel is `never`.

### Subset and Equivalence

`Range.isSubset(sub, sup)` returns `true` if every version that satisfies
`sub` also satisfies `sup`. This is a pure function because it operates on
the algebraic structure of the ranges, not on a finite set of versions.

The check works by verifying that for every ComparatorSet in `sub`, there
exists a ComparatorSet in `sup` whose bounds fully contain it.

`Range.equivalent(a, b)` returns `true` when `isSubset(a, b)` and
`isSubset(b, a)` are both `true`. This provides a semantic equality check
that goes beyond structural equality -- for example,
`>=1.0.0 <2.0.0` is equivalent to `^1.0.0` after desugaring.

### Range Algebra Correctness: Known node-semver Bugs

The node-semver `subset()` implementation has known correctness issues that
we must handle correctly in our implementation:

- **node-semver #757:** `subset('>=17.2.0', '^17.2.0 || >17')` returns
  `false` but should return `true`. The bug is that node-semver does not
  properly handle subset checks against unions (OR'd comparator sets). Our
  `isSubset` implementation must check whether the sub-range is covered by
  the union of all comparator sets in the super-range, not just by any
  single set.

- **node-semver #703:** Prerelease ranges are not handled correctly in
  subset/intersect operations. For example, subset relationships involving
  prerelease comparators may return incorrect results because the
  prerelease matching policy (tuple restriction) is not applied during
  algebraic reasoning.

Our implementation must include test cases derived from these known bugs to
verify correctness. The subset algorithm should reason about the continuous
version space covered by each range, accounting for prerelease semantics,
rather than relying on per-ComparatorSet containment checks alone.

---

## Diffing

### API Surface

```text
SemVer.diff(a: SemVer, b: SemVer): VersionDiff
```

### VersionDiff Structure

```text
VersionDiff
  type:  "major" | "minor" | "patch" | "prerelease" | "build" | "none"
  from:  SemVer
  to:    SemVer
  major: number   (b.major - a.major)
  minor: number   (b.minor - a.minor)
  patch: number   (b.patch - a.patch)
```

### Classification Rules

The `type` field indicates the most significant field that changed:

| Condition | Type |
| :-------- | :--- |
| `a.major !== b.major` | `"major"` |
| `a.minor !== b.minor` | `"minor"` |
| `a.patch !== b.patch` | `"patch"` |
| Prerelease arrays differ | `"prerelease"` |
| Only build metadata differs | `"build"` |
| All fields identical | `"none"` |

Fields are checked in the order listed; the first difference determines the
type. This means a change from `1.2.3` to `2.0.0` is classified as
`"major"` even though minor and patch also changed.

### Delta Values

The numeric delta fields (`major`, `minor`, `patch`) are simple arithmetic
differences: `b.field - a.field`. They can be negative if `b` is a lower
version than `a`. This makes the diff directional -- `diff(1.0.0, 2.0.0)`
has `major: 1`, while `diff(2.0.0, 1.0.0)` has `major: -1`.

### Build Metadata

Build metadata changes are surfaced as type `"build"` but do not affect
version precedence. This follows from the SemVer spec: build metadata is
informational only and is ignored in comparisons. The diff still captures
it so callers can detect metadata-only changes when needed (e.g., CI build
number updates).

---

## Implementation Notes

### Dependency Chain

Operations depend on the data model and parser layers:

```text
src/utils/compare.ts  --> Order<SemVer> --> src/schemas/ (data model)
src/utils/matching.ts --> compare.ts + Range/Comparator (data model)
src/utils/algebra.ts  --> matching.ts + ComparatorSet manipulation
src/utils/diff.ts     --> src/schemas/ (SemVer, VersionDiff)
```

The parser is not a dependency of operations. Operations work on
already-parsed instances. The parser produces the instances that operations
consume.

### Implementation Order

Recommended build sequence based on dependencies:

1. **`Order<SemVer>`** in `src/utils/compare.ts` -- foundation for everything else
2. **Comparison helpers** in `src/utils/compare.ts` -- derived from Order
3. **Single Comparator matching** in `src/utils/matching.ts` -- foundation for range matching
4. **satisfies** in `src/utils/matching.ts` -- uses Comparator matching
5. **filter, maxSatisfying, minSatisfying** in `src/utils/matching.ts` -- use satisfies + Order
6. **diff** in `src/utils/diff.ts` -- independent, can be built in parallel with matching
7. **union** in `src/utils/algebra.ts` -- straightforward set concatenation
8. **isSubset / equivalent** in `src/utils/algebra.ts` -- algebraic checks on ComparatorSets
9. **intersect** in `src/utils/algebra.ts` -- most complex, needs ComparatorSet merging + solver
10. **simplify** in `src/utils/algebra.ts` -- optimization pass, can come last

### Range Desugaring: The `-0` Trick

When desugaring caret and tilde ranges to comparator pairs, the upper bound
must use the `-0` prerelease suffix to correctly exclude prereleases of the
upper version. For example:

- `^1.2.3` desugars to `>=1.2.3 <2.0.0-0` (not `<2.0.0`)
- `~1.2.3` desugars to `>=1.2.3 <1.3.0-0` (not `<1.3.0`)

The `0` prerelease identifier is the lowest possible prerelease (numeric
identifiers sort before alphanumeric, and `0` is the smallest integer), so
`<2.0.0-0` means "strictly less than the absolute minimum prerelease of
2.0.0". This correctly excludes `2.0.0-alpha.1`, `2.0.0-beta.0`, etc.,
while including all `1.x.x` versions including their prereleases (subject
to the prerelease matching policy above).

Without `-0`, `<2.0.0` would also exclude `2.0.0` prereleases by the
prerelease matching rule, but only accidentally -- the `-0` suffix makes the
intent explicit and ensures correct behavior even in range algebra operations
where comparators may be recombined.

### Version 0.x Caret Convention

The caret operator (`^`) has special behavior for 0.x versions, following
node-semver convention for the "anything may change" initial development
range:

- `^0.1.2` means `>=0.1.2 <0.2.0-0` -- pins the minor version, because
  in 0.x development, minor bumps indicate breaking changes.
- `^0.0.1` means `>=0.0.1 <0.0.2-0` -- pins the patch version, because
  in 0.0.x development, even patch bumps may break.
- `^1.2.3` means `>=1.2.3 <2.0.0-0` -- standard behavior for stable
  versions, pins the major.

The rule: the caret allows changes to the right of the leftmost non-zero
component. This is implemented in the parser's range desugaring logic but
documented here because it directly affects which versions satisfy a range.

### Performance Considerations

- Comparison functions are called frequently (sorting, matching). Keep them
  allocation-free: compare fields directly, avoid intermediate objects.
- `Range.satisfies` should short-circuit on the first matching
  ComparatorSet (OR semantics).
- `Range.filter` should avoid sorting the result array; preserve input
  order and let callers sort if needed.
- `Range.intersect` generates a cross-product of ComparatorSets. For
  ranges with many sets, this can be quadratic. Prune unsatisfiable
  candidates early to keep the working set small.

### Testing Priorities

- **Comparison:** Test all prerelease precedence edge cases from SemVer
  2.0.0 Section 11, including mixed numeric/alphanumeric identifiers and
  varying array lengths.
- **Range Matching:** Test prerelease matching behavior, empty version
  arrays, and ranges that match everything (`*`) or nothing.
- **Range Algebra:** Test intersection of disjoint ranges (expect error),
  overlapping ranges, nested ranges, and equivalence of desugared forms.
- **Diffing:** Test all classification types, symmetric diff properties,
  and build-metadata-only changes.

---

## Related Documentation

**Design Spec:**

- [semver-effect Design Spec](../../../docs/specs/semver-effect-design.md) --
  Approved specification defining the full API surface

**Sibling Design Docs:**

- [Architecture](architecture.md) -- System architecture and component overview
- data-model.md -- Core data types in `src/schemas/` (SemVer, Range, Comparator, VersionDiff)
- parser.md -- Recursive descent parser design
- error-model.md -- Error hierarchy and typed error channels

---

**Document Status:** Current -- covers all four operation categories from the
approved spec with detailed research findings on prerelease semantics, range
desugaring, and node-semver correctness issues. Implementation has not started;
this document will be updated as operations are built and tested.

**Next Steps:** Begin implementation with `Order<SemVer>` and comparison helpers.
Update this document as each operation group is completed.
