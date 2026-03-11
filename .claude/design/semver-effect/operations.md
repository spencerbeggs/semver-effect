---
status: current
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-11
last-synced: 2026-03-11
completeness: 95
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
ranges, performing range algebra, bumping versions, and computing structured
diffs.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Comparison Operations](#comparison-operations)
5. [Range Matching](#range-matching)
6. [Range Algebra](#range-algebra)
7. [Bumping](#bumping)
8. [Diffing](#diffing)
9. [Pretty Printing](#pretty-printing)
10. [Implementation Notes](#implementation-notes)
11. [Related Documentation](#related-documentation)

---

## Overview

This document covers the six categories of operations exposed by
semver-effect: comparison, range matching, range algebra, bumping, diffing,
and pretty printing. These operations sit above the data model and parser
layers and provide the primary user-facing functionality.

**Scope:**

- Comparison functions on SemVer instances (pure, no Effect wrapper)
- Range matching functions that test versions against Range instances
- Range algebra functions that combine, simplify, and relate ranges
- Bump functions that produce new versions from existing ones
- Diff function that computes structured deltas between versions
- Pretty-print function using Effect Match.exhaustive

**Key Characteristics:**

- Comparison and matching operations are pure functions with no error channel
- Range algebra: `intersect` returns Effect (can fail), `union`/`simplify`/
  `isSubset`/`equivalent` are pure
- Bump operations are pure functions (no Effect wrapper)
- All binary operations use `Function.dual` for data-first/data-last support
- All operations are accessed through namespace modules: `SemVer.gt()`,
  `Range.satisfies()`, `SemVer.bump.major()`, `PrettyPrint.prettyPrint()`.
  No standalone function exports exist in the public API.

**Public API Access (namespace modules):**

- `SemVer.*` -- comparison, collection, diff, bump, ordering, Schema transforms
- `Range.*` -- matching, algebra, Schema transforms
- `PrettyPrint.*` -- pretty printing

**Internal File Locations:**

- `src/utils/compare.ts` -- comparison helpers and collection operations
- `src/utils/matching.ts` -- range matching logic
- `src/utils/algebra.ts` -- range algebra operations
- `src/utils/bump.ts` -- version bump operations
- `src/utils/diff.ts` -- version diffing
- `src/utils/order.ts` -- Order instances
- `src/utils/prettyPrint.ts` -- Match.exhaustive printer

---

## Current State

All operation categories are fully implemented and tested.

| Operation Group | Status | File |
| :-------------- | :----- | :--- |
| Comparison | Implemented | `src/utils/compare.ts` |
| Order | Implemented | `src/utils/order.ts` |
| Range Matching | Implemented | `src/utils/matching.ts` |
| Range Algebra | Implemented | `src/utils/algebra.ts` |
| Bumping | Implemented | `src/utils/bump.ts` |
| Diffing | Implemented | `src/utils/diff.ts` |
| Pretty Printing | Implemented | `src/utils/prettyPrint.ts` |

---

## Rationale

### Why Pure Comparison Functions

Comparison operations operate on already-parsed SemVer instances. Since
parsing has already validated the input, these functions cannot fail and do
not need Effect wrappers. Keeping them pure enables direct use in Effect's
`Array.sort`, `SortedSet`, and other collection utilities.

### Why Range Matching Returns Plain Values

`satisfies` returns a plain `boolean`, `maxSatisfying` and `minSatisfying`
return `Option<SemVer>`. "No match" is a normal outcome, not an error.

### Why intersect Uses Effect but union/simplify Do Not

`intersect` can fail when two ranges have no overlap
(`UnsatisfiableConstraintError`). `union`, `simplify`, `isSubset`, and
`equivalent` cannot fail and are pure functions.

### Why Bump Operations Are in a Sub-Namespace

Bump operations are grouped under `SemVer.bump.*` (`SemVer.bump.major`,
`SemVer.bump.minor`, etc.) rather than being top-level on `SemVer` or static
methods on the class. This follows the Effect convention of grouping related
operations and keeps the `SemVer` namespace organized. Internally they are
standalone functions in `src/utils/bump.ts`; the `SemVer.bump` object in
`src/SemVer.ts` simply collects them.

---

## Comparison Operations

### API Surface

Accessed via the `SemVer` namespace. All binary operations use
`Function.dual(2, ...)` for data-first/data-last:

```text
SemVer.compare(self, that): -1 | 0 | 1
SemVer.equal(self, that): boolean
SemVer.gt(self, that): boolean
SemVer.gte(self, that): boolean
SemVer.lt(self, that): boolean
SemVer.lte(self, that): boolean
SemVer.neq(self, that): boolean
SemVer.isPrerelease(v): boolean
SemVer.isStable(v): boolean
SemVer.truncate(v, level): SemVer
SemVer.sort(versions): Array<SemVer>
SemVer.rsort(versions): Array<SemVer>
SemVer.max(versions): Option<SemVer>
SemVer.min(versions): Option<SemVer>
SemVer.compareWithBuild(self, that): -1 | 0 | 1
```

**Internal implementation:** `src/utils/compare.ts`

### Ordering Rules (SemVer 2.0.0 Section 11)

1. **Major, minor, patch** are compared numerically in that order.
2. **Prerelease** identifiers are compared left to right:
   - Numeric identifiers are compared as integers.
   - Alphanumeric identifiers are compared lexically (ASCII sort order).
   - Numeric identifiers always have lower precedence than alphanumeric.
   - A shorter prerelease array has lower precedence if all preceding
     identifiers are equal.
3. **A version with prerelease has lower precedence** than the same version
   without prerelease.
4. **Build metadata is ignored** in all standard comparisons.

### Order & Equivalence Instances

Accessed via the `SemVer` namespace:

- **`SemVer.Order`**: Standard SemVer 2.0.0 precedence. Build metadata ignored.
  (Internally: `SemVerOrder` from `src/utils/order.ts`.)
- **`SemVer.OrderWithBuild`**: Extends standard comparison with lexicographic
  build metadata comparison when versions are otherwise equal. No build
  metadata sorts before having build metadata.
  (Internally: `SemVerOrderWithBuild` from `src/utils/order.ts`.)
- **`SemVer.Equivalence`**: `Equivalence<SemVer>` instance that delegates to
  `SemVer.equal`.

`Order` and `OrderWithBuild` are `Order.Order<SemVer>` instances.

### Collection Helpers

- `sort` / `rsort`: Return new arrays, do not mutate input.
- `max` / `min`: Return `Option<SemVer>` -- `Option.none()` for empty arrays,
  `Option.some(result)` otherwise.

### Truncation

`truncate(v, level)` strips metadata from a version:

- `truncate(v, "prerelease")` -- removes both prerelease and build
- `truncate(v, "build")` -- removes build only, keeps prerelease

Uses `dual(2, ...)` for both calling conventions.

### Equality Semantics

`equal` checks structural equality of major, minor, patch, and prerelease.
Build metadata excluded per spec. Delegates to `Equal.equals`.

---

## Range Matching

### API Surface

Accessed via the `Range` namespace:

```text
Range.satisfies(version, range): boolean
Range.filter(versions, range): Array<SemVer>
Range.maxSatisfying(versions, range): Option<SemVer>
Range.minSatisfying(versions, range): Option<SemVer>
```

All use `Function.dual(2, ...)`.

**Internal implementation:** `src/utils/matching.ts`

### Matching Algorithm

A version satisfies a Range when it satisfies at least one ComparatorSet
(OR). A version satisfies a ComparatorSet when it satisfies every Comparator
(AND). Comparator matching uses the SemVerOrder instance.

### Prerelease Matching Behavior

A prerelease version only satisfies a range comparator if the comparator's
version shares the same `[major, minor, patch]` tuple AND has a non-empty
prerelease. This prevents prereleases from "leaking" into ranges not
explicitly written to include them.

**Examples:**

- `3.0.0-beta.1` satisfies `>=3.0.0-alpha.1` (same tuple)
- `3.0.0-beta.1` does NOT satisfy `>=2.9.0` (different tuple)
- `1.0.0-rc.1` does NOT satisfy `>=0.9.0 <2.0.0` (no prerelease comparator
  with matching tuple)
- `1.0.0-rc.1` satisfies `>=1.0.0-alpha.1 <2.0.0` (first comparator has
  matching tuple)

### No `includePrerelease` Option

Unlike node-semver, there is no `includePrerelease` flag. The strict
same-tuple policy is always enforced. This eliminates a class of
misconfiguration errors.

---

## Range Algebra

### API Surface

Accessed via the `Range` namespace:

```text
Range.union(a, b): Range
Range.intersect(a, b): Effect<Range, UnsatisfiableConstraintError>
Range.simplify(range): Range
Range.isSubset(sub, sup): boolean
Range.equivalent(a, b): boolean
```

`union`, `simplify`, `isSubset`, and `equivalent` are pure functions.
`intersect` returns Effect because it can fail. All binary operations use
`Function.dual(2, ...)`.

**Internal implementation:** `src/utils/algebra.ts`

### Union

Concatenates ComparatorSets from both ranges (OR semantics). Always succeeds.

### Intersection

Cross-product of ComparatorSets. Each pair is merged, then checked for
satisfiability. Unsatisfiable candidates are pruned. If no candidates
survive, fails with `UnsatisfiableConstraintError`.

Satisfiability checking handles lower/upper bound conflicts and equality
constraints.

### Simplify

Removes redundant ComparatorSets -- sets that are strict subsets of another
set in the same Range. Best-effort.

### Subset and Equivalence

`isSubset(sub, sup)`: Every ComparatorSet in `sub` must be contained by some
ComparatorSet in `sup`. Uses comparator implication logic.

`equivalent(a, b)`: `isSubset(a, b) && isSubset(b, a)`.

---

## Bumping

### API Surface

Accessed via the `SemVer.bump` sub-namespace:

```text
SemVer.bump.major(v): SemVer
SemVer.bump.minor(v): SemVer
SemVer.bump.patch(v): SemVer
SemVer.bump.prerelease(v, id?): SemVer
SemVer.bump.release(v): SemVer
```

All are pure functions returning new SemVer instances. Since Data.TaggedClass
constructors have no runtime schema validation, bumped values are constructed
directly from computed fields that are correct by construction.

The `bump` sub-namespace is a plain object on the `SemVer` namespace module
(`src/SemVer.ts`), grouping the functions from `src/utils/bump.ts`.

**Internal implementation:** `src/utils/bump.ts`

### Bump Rules

**`SemVer.bump.major`**: Increments major, resets minor/patch to 0, clears
prerelease/build. `1.2.3-alpha` -> `2.0.0`.

**`SemVer.bump.minor`**: Increments minor, resets patch to 0, clears
prerelease/build. `1.2.3-alpha` -> `1.3.0`.

**`SemVer.bump.patch`**: Increments patch, clears prerelease/build.
`1.2.3-alpha` -> `1.2.4`.

**`SemVer.bump.prerelease(v, id?)`**:

- No prerelease, no id: bump patch, add `[0]`. `1.0.0` -> `1.0.1-0`
- No prerelease, with id: bump patch, add `[id, 0]`. `1.0.0` -> `1.0.1-beta.0`
- Has prerelease, matching prefix: increment last numeric, or append 0.
  `1.0.0-alpha.1` -> `1.0.0-alpha.2`
- Has prerelease, different id: reset to `[id, 0]`.
  `1.0.0-alpha.1` with id `"beta"` -> `1.0.0-beta.0`

**`SemVer.bump.release`**: Strips prerelease and build, keeps version numbers.
`1.2.3-alpha.1+build` -> `1.2.3`.

---

## Diffing

### API Surface

Accessed via the `SemVer` namespace:

```text
SemVer.diff(a, b): VersionDiff
```

Uses `Function.dual(2, ...)`. Pure function -- always produces a result.

**Internal implementation:** `src/utils/diff.ts`

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

Delta fields are signed: `b.field - a.field`.

---

## Pretty Printing

### API Surface

Accessed via the `PrettyPrint` namespace:

```text
PrettyPrint.prettyPrint(value: Printable): string
type PrettyPrint.Printable = SemVer | Comparator | Range | VersionDiff
```

Uses `Match.type<Printable>()` with `Match.tag` for each type and
`Match.exhaustive` to ensure all types are handled. Delegates to each
type's `toString()` method.

**Internal implementation:** `src/utils/prettyPrint.ts`

---

## Implementation Notes

### Dependency Chain

```text
src/utils/order.ts    --> Order<SemVer> --> src/schemas/ (data model)
src/utils/compare.ts  --> order.ts + Equal from effect
src/utils/matching.ts --> order.ts + Range/Comparator (data model)
src/utils/algebra.ts  --> order.ts + ComparatorSet manipulation
src/utils/diff.ts     --> src/schemas/ (SemVer, VersionDiff)
src/utils/bump.ts     --> src/schemas/SemVer.ts
src/utils/prettyPrint.ts --> Match + all schema types
```

### The `-0` Trick in Desugaring

Upper bounds in caret/tilde ranges use `-0` prerelease suffix (e.g.,
`<2.0.0-0`) to exclude prereleases of the next version while including
all prereleases of the current range.

### Version 0.x Caret Convention

- `^0.1.2` -> `>=0.1.2 <0.2.0-0` (pins minor)
- `^0.0.1` -> `>=0.0.1 <0.0.2-0` (pins patch)
- `^1.2.3` -> `>=1.2.3 <2.0.0-0` (standard, pins major)

Rule: caret allows changes to the right of the leftmost non-zero component.

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture and component overview
- [data-model.md](data-model.md) -- Core types (SemVer, Range, Comparator, VersionDiff)
- [parser.md](parser.md) -- Parser design and desugaring rules
- [error-model.md](error-model.md) -- Error types for algebra operations

---

**Document Status:** Current -- covers all six operation categories as
implemented. All operations are tested.
