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
  - parser.md
  - operations.md
  - node-semver-divergences.md
dependencies:
  - data-model.md
  - parser.md
  - operations.md
---

# SemVer 2.0.0 Compliance

Documents how semver-effect implements the SemVer 2.0.0 specification,
section by section, covering strict grammar enforcement, precedence rules,
and areas where the library extends beyond the spec.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Spec Coverage Summary](#spec-coverage-summary)
4. [Grammar Compliance](#grammar-compliance)
5. [Precedence Compliance](#precedence-compliance)
6. [Semantic Rules](#semantic-rules)
7. [Build Metadata Handling](#build-metadata-handling)
8. [Extensions Beyond the Spec](#extensions-beyond-the-spec)
9. [Strict Rejections](#strict-rejections)
10. [Test Vectors from the Spec](#test-vectors-from-the-spec)
11. [Related Documentation](#related-documentation)

---

## Overview

semver-effect is a strict SemVer 2.0.0 implementation. The version parsing,
formatting, comparison, and equality operations conform exactly to the
specification at <https://semver.org>. There is no loose mode, no coercion,
and no tolerance for inputs that deviate from the grammar.

**Compliance principle:** If the SemVer 2.0.0 specification defines a rule
with MUST or MUST NOT, our implementation enforces it. If the spec is silent
on a topic (ranges, caching, etc.), we clearly document it as an extension.

**Key compliance areas:**

- BNF grammar for version strings (Sections 2, 9, 10)
- Precedence rules for comparison and ordering (Section 11)
- Build metadata semantics (excluded from precedence)
- Leading zero prohibition in numeric identifiers
- Character set restrictions (`[0-9A-Za-z-]` only)

---

## Current State

Full compliance with SemVer 2.0.0 is implemented and tested. The
`spec-compliance.test.ts` test file contains 166 data-driven tests against
spec-derived vectors. Additional compliance coverage exists across
`parseVersion.test.ts`, `order.test.ts`, `compare.test.ts`, and
`schemas.test.ts`.

---

## Spec Coverage Summary

| Spec Section | Topic | Compliance | Implementation |
| :--- | :--- | :--- | :--- |
| 2 | Version format X.Y.Z | Full | `parseValidSemVer` in grammar.ts |
| 3 | Immutability of released versions | Full | Data.TaggedClass (frozen) |
| 4 | Major version zero semantics | N/A | Semantic rule, not enforced by parser |
| 5 | Initial public API (1.0.0) | N/A | Semantic rule, not enforced by parser |
| 6 | Patch increment rules | N/A | Semantic rule; `bumpPatch` is available |
| 7 | Minor increment rules | N/A | Semantic rule; `bumpMinor` is available |
| 8 | Major increment rules | N/A | Semantic rule; `bumpMajor` is available |
| 9 | Pre-release syntax | Full | Grammar + typed identifier storage |
| 10 | Build metadata syntax | Full | Grammar + string array storage |
| 11 | Precedence rules | Full | SemVerOrder in order.ts |
| BNF | Grammar productions | Full | Recursive descent in grammar.ts |
| FAQ | v-prefix rejection | Full | Immediate rejection at position 0 |
| FAQ | Regex validation | Compatible | Parser accepts same set as spec regex |

---

## Grammar Compliance

### Version Core (Section 2)

The spec requires exactly three non-negative integer components separated by
dots: `MAJOR.MINOR.PATCH`. Our parser enforces:

- Exactly three dot-separated numeric identifiers
- No leading zeros on any component (`01.0.0` rejected)
- No negative numbers (`-1.0.0` rejected)
- No extra components (`1.0.0.0` rejected)
- No missing components (`1.0` rejected, `1` rejected)

**Implementation:** `parseVersionCore` in `src/utils/grammar.ts` calls
`parseNumericIdentifier` three times with dot separators, then verifies
end-of-input.

### Numeric Identifiers (Sections 2, 9)

The BNF defines:

```bnf
<numeric identifier> ::= "0"
                       | <positive digit>
                       | <positive digit> <digits>
```

Our parser enforces:

- Single `"0"` is valid
- Multi-digit numbers must start with a positive digit (1-9)
- `"00"`, `"01"`, `"001"` are all rejected
- Integer overflow check via `Number.isSafeInteger()`

This rule applies to major, minor, patch, AND pre-release numeric identifiers.
It does NOT apply to build identifiers (see Build Metadata below).

### Pre-release Syntax (Section 9)

The spec requires:

- Non-empty, dot-separated list of identifiers
- Each identifier is either numeric (digits only, no leading zeros) or
  alphanumeric (contains at least one non-digit character)
- Identifiers must not be empty (no trailing dots, no double dots)

Our parser uses a two-phase approach:

1. **Consume** all characters matching `[0-9A-Za-z-]`
2. **Classify** after consumption: if all digits, it is numeric (validate no
   leading zeros); if any non-digit, it is alphanumeric (no leading zero
   restriction)

This correctly handles tricky cases:

- `0alpha` -- alphanumeric (contains letter), no leading zero violation
- `0-0` -- alphanumeric (contains hyphen), no leading zero violation
- `--` -- alphanumeric (hyphens are non-digits), valid
- `01` -- numeric (all digits), rejected for leading zero
- `-1` -- alphanumeric (contains hyphen), valid

### Build Metadata Syntax (Section 10)

The spec requires:

- Non-empty, dot-separated list of identifiers
- Build identifiers use `<digits>` not `<numeric identifier>`
- Leading zeros ARE allowed in build identifiers (`001` is valid)
- Identifiers must not be empty

Our parser stores build identifiers as `ReadonlyArray<string>`, preserving
leading zeros. The `+` delimiter is consumed once; a second `+` in the input
is rejected as an invalid character in the build identifier.

### Character Set

The spec allows exactly `[0-9A-Za-z-]` (63 characters) in identifiers. Our
parser rejects:

- Underscore (`_`)
- Any Unicode characters beyond ASCII
- Dots within identifiers (dots are separators)
- Plus within identifiers (plus is build delimiter)
- Spaces, tabs, or other whitespace
- Any other punctuation or special characters

### Whitespace

The spec does not permit whitespace within version strings. Our parser does
not trim input and rejects any whitespace:

- `" 1.0.0"` -- rejected (leading space)
- `"1.0.0 "` -- rejected (trailing space)
- `"1. 0.0"` -- rejected (internal space)

---

## Precedence Compliance

### Section 11.1: Component Separation

Build metadata is completely excluded from precedence. Our `SemVerOrder`
instance compares major, minor, patch, and prerelease only. Build metadata
is not examined.

### Section 11.2: Numeric Comparison

Major, minor, and patch are compared numerically left to right:

```text
1.0.0 < 2.0.0 < 2.1.0 < 2.1.1
```

**Implementation:** Direct integer comparison of `a.major - b.major`, then
`a.minor - b.minor`, then `a.patch - b.patch`.

### Section 11.3: Pre-release vs Normal

A pre-release version has lower precedence than the same version without
pre-release:

```text
1.0.0-alpha < 1.0.0
```

**Implementation:** When major.minor.patch are equal, an empty prerelease
array indicates a normal (release) version, which has higher precedence.

### Section 11.4: Pre-release Precedence

Pre-release identifiers are compared left to right:

- **11.4.1:** Numeric identifiers compared as integers (`2 < 11`)
- **11.4.2:** Alphanumeric identifiers compared lexically (ASCII sort)
- **11.4.3:** Numeric always has lower precedence than alphanumeric (`1 < "alpha"`)
- **11.4.4:** Shorter array has lower precedence when all preceding identifiers
  are equal (`["alpha"] < ["alpha", 1]`)

**Implementation:** `SemVerOrder` in `src/utils/order.ts` implements this
algorithm with `typeof` checks to distinguish numeric from alphanumeric
identifiers.

### Spec Precedence Chain

The spec provides the canonical ordering:

```text
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
< 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
```

All 28 ordered pairs derivable from this chain are tested in
`spec-compliance.test.ts`.

---

## Semantic Rules

Sections 4-8 of the spec define semantic rules about when to increment which
component (patch for bug fixes, minor for new features, major for breaking
changes). These are guidelines for humans, not enforceable by software.

Our library provides the bump operations (`bumpMajor`, `bumpMinor`,
`bumpPatch`, `bumpPrerelease`, `bumpRelease`) but does not enforce semantic
rules about when each should be used. The caller is responsible for choosing
the correct bump type.

Section 3 states that released versions are immutable. Our `SemVer` type
enforces this at the language level via `Data.TaggedClass` (frozen
instances, `ReadonlyArray` for prerelease and build).

---

## Build Metadata Handling

The spec defines three rules for build metadata:

1. **Syntax:** Plus sign followed by dot-separated identifiers using
   `[0-9A-Za-z-]` characters. Leading zeros allowed.
2. **Precedence:** Build metadata MUST be ignored when determining version
   precedence.
3. **Equality:** Two versions differing only in build metadata have the same
   precedence.

Our implementation:

- **Storage:** Build metadata is preserved in the `build: ReadonlyArray<string>`
  field. It is never stripped or lost.
- **toString:** Build metadata is included in string output
  (`1.0.0-alpha+001`).
- **Equal:** Custom `Equal.symbol` implementation excludes build metadata.
  `Equal.equals(parse("1.0.0+a"), parse("1.0.0+b"))` returns `true`.
- **Hash:** Custom `Hash.symbol` implementation excludes build metadata.
  Versions differing only in build produce identical hashes.
- **Order:** `SemVerOrder` ignores build metadata. Two versions differing
  only in build compare as `0`.
- **SortedSet deduplication:** Because Equal ignores build metadata,
  `SortedSet` treats `1.0.0+build1` and `1.0.0+build2` as the same element
  (first-in wins). This is correct per the spec.

An additional `SemVerOrderWithBuild` Order instance is provided for cases
where build metadata ordering is desired (e.g., CI pipelines). This is an
extension beyond the spec.

---

## Extensions Beyond the Spec

The SemVer 2.0.0 specification defines version format, precedence, and
semantic rules only. The following features are extensions provided by
semver-effect that are NOT governed by the spec:

### Range Expressions

Ranges (`>=1.0.0 <2.0.0`), tilde ranges (`~1.2.3`), caret ranges
(`^1.2.3`), x-ranges (`1.x`), and hyphen ranges (`1.2.3 - 2.3.4`) are
node-semver conventions. Our implementation follows node-semver's range
grammar and desugaring rules. See [node-semver-divergences.md](node-semver-divergences.md)
for detailed comparison.

### Range Satisfaction

The `satisfies()` function and the prerelease matching policy (same-tuple
rule) are node-semver conventions. The spec does not define what it means
for a version to "satisfy" a range.

### Range Algebra

`union`, `intersect`, `simplify`, `isSubset`, and `equivalent` are
original additions not found in the spec or node-semver's core API.

### Version Caching

The `VersionCache` service (sorted set of versions with query, resolution,
grouping, and navigation) is an original addition.

### Bump Operations

The spec describes when to increment components (Sections 6-8) but does not
define a programmatic bump operation. Our `bumpMajor`, `bumpMinor`,
`bumpPatch`, `bumpPrerelease`, and `bumpRelease` functions follow node-semver
conventions.

### Pretty Printing

The `prettyPrint` function using `Match.exhaustive` is an original addition.

### Structured Diffing

The `diff` function returning a `VersionDiff` with type classification and
signed deltas is an original addition.

---

## Strict Rejections

The following inputs are accepted by some SemVer implementations but are
rejected by semver-effect in accordance with the spec:

| Input | Reason | Spec Reference |
| :--- | :--- | :--- |
| `v1.2.3` | v-prefix not in grammar | FAQ |
| `V1.2.3` | V-prefix not in grammar | FAQ |
| `=1.2.3` | Equals prefix not in grammar | Grammar |
| `01.0.0` | Leading zero in major | Section 2 |
| `1.01.0` | Leading zero in minor | Section 2 |
| `1.0.01` | Leading zero in patch | Section 2 |
| `1.0.0-01` | Leading zero in numeric prerelease | Section 9 |
| `1.0.0-alpha.01` | Leading zero in numeric prerelease | Section 9 |
| `1.0` | Missing patch component | Section 2 |
| `1` | Missing minor and patch | Section 2 |
| `1.0.0.0` | Extra component | Grammar |
| `1.0.0-` | Empty prerelease | Section 9 |
| `1.0.0+` | Empty build | Section 10 |
| `1.0.0-beta.` | Trailing dot in prerelease | Section 9 |
| `1.0.0-beta..1` | Empty identifier (double dot) | Section 9 |
| `1.0.0-beta_1` | Invalid character underscore | Grammar |
| `1.0.0-beta!` | Invalid character exclamation | Grammar |
| `1.0.0+build+extra` | Second plus invalid | Grammar |
| `-1.0.0` | Negative number not in grammar | Grammar |
| `1.0.0` | Leading whitespace | Grammar |
| `1.0.0` | Trailing whitespace | Grammar |

**Not rejected (tricky-but-valid):**

| Input | Why Valid | Spec Reference |
| :--- | :--- | :--- |
| `1.0.0--` | Hyphen is a valid non-digit | Section 9, BNF |
| `1.0.0---` | Multiple hyphens valid as alphanumeric | Section 9, BNF |
| `1.0.0-0alpha` | Contains letter, so alphanumeric | Section 9, BNF |
| `1.0.0-0-0` | Contains hyphen, so alphanumeric | Section 9, BNF |
| `1.0.0-alpha.-1` | `-1` contains hyphen, so alphanumeric | Section 9, BNF |
| `1.0.0+001` | Build allows `<digits>` (leading zeros ok) | Section 10 |
| `0.0.0` | All zeros is valid | Section 2 |
| `0.0.0-0` | Zero numeric prerelease identifier | Section 9 |

---

## Test Vectors from the Spec

### Valid Versions (Section 9, 10 examples)

```text
1.0.0-alpha
1.0.0-alpha.1
1.0.0-0.3.7
1.0.0-x.7.z.92
1.0.0-x-y-z.--
1.0.0-alpha+001
1.0.0+20130313144700
1.0.0-beta+exp.sha.5114f85
1.0.0+21AF26D3----117B344092BD
```

All are tested in `spec-compliance.test.ts` via the `validVersions` fixture.

### Precedence Chain (Section 11)

```text
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
< 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
```

All 28 ordered pairs are tested.

### Build Metadata Equality

```text
1.0.0-alpha+001    == 1.0.0-alpha+002
1.0.0+build1       == 1.0.0+build2
1.0.0+20130313     == 1.0.0+different
```

Tested via Equal.equals assertions.

### Spec FAQ Regex Compatibility

The spec FAQ provides an official regex for validation. Our recursive descent
parser accepts the same set of strings as the spec regex. Any string accepted
by the regex is accepted by our parser, and vice versa.

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture
- [data-model.md](data-model.md) -- SemVer, Range, Comparator types
- [parser.md](parser.md) -- Recursive descent parser implementation
- [operations.md](operations.md) -- Comparison and ordering operations
- [node-semver-divergences.md](node-semver-divergences.md) -- Comparison with
  node-semver behavior
- [error-model.md](error-model.md) -- Parse error types with position info
- [testing.md](testing.md) -- Test suite covering spec compliance

---

**Document Status:** Current -- documents strict SemVer 2.0.0 compliance
across grammar, precedence, and build metadata handling. All spec rules
are implemented and tested. Extensions beyond the spec are clearly identified.
