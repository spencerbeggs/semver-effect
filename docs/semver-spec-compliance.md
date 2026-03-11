# SemVer 2.0.0 Spec Compliance

How `semver-effect` implements the SemVer 2.0.0 specification and where it
extends beyond it.

## Table of Contents

- [Spec Compliance Summary](#spec-compliance-summary)
- [Version Parsing](#version-parsing)
- [Precedence and Comparison](#precedence-and-comparison)
- [Build Metadata Handling](#build-metadata-handling)
- [Prerelease Comparison Rules](#prerelease-comparison-rules)
- [Range Syntax (Extension)](#range-syntax-extension)
- [Prerelease Filtering in Ranges](#prerelease-filtering-in-ranges)
- [Edge Cases](#edge-cases)

---

## Spec Compliance Summary

`semver-effect` fully implements the SemVer 2.0.0 specification as published
at [semver.org](https://semver.org). The parser implements the BNF grammar from
the spec using a recursive descent parser (no regex).

| Spec Requirement | Status | Notes |
| --- | --- | --- |
| Version format `MAJOR.MINOR.PATCH` | Compliant | All three components required |
| No leading zeros in numeric identifiers | Compliant | Rejected at parse time with position info |
| Prerelease syntax (Section 9) | Compliant | Dot-separated, no empty identifiers |
| Build metadata syntax (Section 10) | Compliant | Leading zeros allowed in build identifiers |
| Precedence rules (Section 11) | Compliant | Build metadata ignored in comparison |
| `v` prefix rejected | Compliant | Spec FAQ: "v1.2.3" is not a semantic version |

---

## Version Parsing

The parser implements the SemVer 2.0.0 BNF grammar character by character:

```text
<valid semver> ::= <version core>
                 | <version core> "-" <pre-release>
                 | <version core> "+" <build>
                 | <version core> "-" <pre-release> "+" <build>

<version core> ::= <major> "." <minor> "." <patch>
```

### What is accepted

- `1.0.0` -- basic version
- `1.0.0-alpha.1` -- with prerelease
- `1.0.0+build.42` -- with build metadata
- `1.0.0-beta.3+exp.sha.5114f85` -- both prerelease and build
- `0.0.0` -- all zeros are valid
- `1.0.0-x-y-z.--` -- hyphens are valid identifier characters
- `1.0.0+001` -- leading zeros allowed in build identifiers

### What is rejected

| Input | Reason |
| --- | --- |
| `v1.0.0` | `v` prefix not in grammar |
| `1.0` | Missing patch component |
| `1` | Missing minor and patch |
| `01.0.0` | Leading zero in major |
| `1.0.0-01` | Leading zero in numeric prerelease identifier |
| `1.0.0-` | Empty prerelease |
| `1.0.0+` | Empty build metadata |
| `1.0.0-beta.` | Trailing dot (empty identifier) |
| `1.0.0-beta_1` | Underscore not in valid character set `[0-9A-Za-z-]` |
| `=1.0.0` | `=` prefix not in grammar |

All rejections produce an `InvalidVersionError` with the input string and the
character position where parsing failed.

---

## Precedence and Comparison

Precedence follows Section 11 of the SemVer 2.0.0 spec exactly.

### Section 11.1-11.2: Numeric Core Comparison

Major, minor, and patch are compared numerically from left to right:

```text
1.0.0 < 2.0.0 < 2.1.0 < 2.1.1
```

### Section 11.3: Prerelease vs Normal

A prerelease version has lower precedence than the same version without
prerelease:

```text
1.0.0-alpha < 1.0.0
```

### Section 11.4: Prerelease Precedence

When two versions share the same major.minor.patch and both have prereleases,
their prerelease identifiers are compared left to right:

1. **Numeric identifiers** are compared as integers: `1 < 2 < 11`
2. **Alphanumeric identifiers** are compared by ASCII byte order: `"alpha" < "beta"`
3. **Numeric always sorts before alphanumeric**: `1 < "alpha"`
4. **Shorter prefix sorts before longer**: `["alpha"] < ["alpha", 1]`

The full precedence chain from the spec:

```text
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
< 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
```

The `SemVerOrder` instance implements this as an `Order<SemVer>` compatible with
Effect's `SortedSet`, `Array.sort`, and other ordering utilities.

---

## Build Metadata Handling

Per Section 10 and 11.1:

> Build metadata MUST be ignored when determining version precedence. Thus
> two versions that differ only in the build metadata, have the same
> precedence.

In `semver-effect`:

- `Equal.equals` ignores build metadata -- `1.0.0+a` equals `1.0.0+b`
- `Hash.hash` ignores build metadata -- equal versions produce the same hash
- `SemVerOrder` ignores build metadata -- `compare(a, b)` returns `0`
- `SemVerOrderWithBuild` includes build metadata for cases where you need a
  total ordering (for example, deduplication in a set where build metadata
  matters)

Build metadata is preserved in the `SemVer` instance and appears in
`toString()` output. It is carried through bump operations only if you
construct new instances manually.

### Build Identifier Syntax

Build identifiers allow leading zeros (the grammar uses `<digits>` not
`<numeric identifier>`):

```text
1.0.0+001    -- valid (build identifier "001")
1.0.0-01     -- INVALID (prerelease numeric identifier with leading zero)
```

---

## Prerelease Comparison Rules

### Numeric vs Alphanumeric Identifiers

The parser determines identifier type by content:

- All digits: **numeric identifier** -- stored as `number`, compared as integer
- Contains any letter or hyphen: **alphanumeric identifier** -- stored as `string`, compared by ASCII

This distinction is critical for correct ordering:

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

const program = Effect.gen(function* () {
  const a = yield* SemVer.fromString("1.0.0-beta.2");
  const b = yield* SemVer.fromString("1.0.0-beta.11");
  console.log(SemVer.compare(a, b)); // -1 (2 < 11, numeric comparison)

  // With string comparison, "2" > "11" would be wrong
});
```

### Case Sensitivity

Identifiers are case-sensitive per the spec. `"Alpha"` and `"alpha"` are
different identifiers. Uppercase ASCII (65-90) sorts before lowercase (97-122):

```text
1.0.0-Alpha < 1.0.0-alpha
```

### Tricky Valid Prerelease Identifiers

| Identifier | Type | Why |
| --- | --- | --- |
| `0` | numeric | Single digit zero |
| `alpha` | alphanumeric | Contains letters |
| `x-y-z` | alphanumeric | Contains hyphens (a valid non-digit character) |
| `--` | alphanumeric | Hyphens are non-digits |
| `0alpha` | alphanumeric | Starts with digit but contains letter |
| `0-0` | alphanumeric | Contains hyphen, so not numeric (no leading-zero error) |

---

## Range Syntax (Extension)

Range expressions are **not part of the SemVer 2.0.0 specification**. They
follow node-semver conventions. `semver-effect` supports:

| Syntax | Example | Expands to |
| --- | --- | --- |
| Exact | `1.2.3` | `=1.2.3` |
| Comparator | `>=1.2.3`, `<2.0.0` | As written |
| Caret | `^1.2.3` | `>=1.2.3 <2.0.0-0` |
| Tilde | `~1.2.3` | `>=1.2.3 <1.3.0-0` |
| X-range | `1.x`, `1.2.*` | `>=1.0.0 <2.0.0-0`, `>=1.2.0 <1.3.0-0` |
| Hyphen | `1.2.3 - 2.3.4` | `>=1.2.3 <=2.3.4` |
| OR | `^1.0.0 \|\| ^3.0.0` | Union of both ranges |
| AND | `>=1.0.0 <2.0.0` | Space-separated (implicit AND) |
| Star | `*` | `>=0.0.0` (match all) |

### The `-0` Upper Bound Convention

When desugaring caret and tilde ranges, the upper bound uses a `-0`
prerelease to exclude prerelease versions of the next major/minor:

```text
^1.2.3  -->  >=1.2.3 <2.0.0-0
```

The `-0` works because `0` is the lowest possible prerelease identifier
(numeric sorts before alphanumeric). So `<2.0.0-0` means "strictly less
than the absolute minimum prerelease of 2.0.0", which effectively excludes
all 2.0.0 prereleases while including `1.x.y` releases.

### Caret Behavior with 0.x.y

Caret ranges on major zero versions pin more tightly, following node-semver
convention:

| Range | Expands to | Rationale |
| --- | --- | --- |
| `^1.2.3` | `>=1.2.3 <2.0.0-0` | Normal: allow minor/patch |
| `^0.2.3` | `>=0.2.3 <0.3.0-0` | Major zero: pin to minor |
| `^0.0.3` | `>=0.0.3 <0.0.4-0` | Double zero: pin to patch |

---

## Prerelease Filtering in Ranges

`semver-effect` follows node-semver's prerelease filtering policy:

> A prerelease version only satisfies a range if at least one comparator
> in the matching comparator set has a prerelease **and** shares the same
> `[major, minor, patch]` tuple.

This means:

```typescript
import { Effect } from "effect";
import { SemVer, Range } from "semver-effect";

const program = Effect.gen(function* () {
  const v = yield* SemVer.fromString("3.0.0-beta.1");

  // Satisfies: comparator >=3.0.0-alpha.0 has prerelease AND same tuple [3,0,0]
  const r1 = yield* Range.fromString(">=3.0.0-alpha.0");
  console.log(Range.satisfies(v, r1)); // true

  // Does NOT satisfy: >=2.9.0 has no prerelease on the [3,0,0] tuple
  // Even though 3.0.0-beta.1 > 2.9.0 by precedence
  const r2 = yield* Range.fromString(">=2.9.0");
  console.log(Range.satisfies(v, r2)); // false
});
```

This policy prevents prerelease versions from "leaking" into ranges that
did not explicitly opt into them. It is a node-semver convention, not a
SemVer spec requirement.

---

## Edge Cases

### Maximum Numeric Values

Version components are JavaScript `number` values. The parser rejects
values exceeding `Number.MAX_SAFE_INTEGER` (`2^53 - 1`):

```text
9007199254740991.0.0   -- valid (MAX_SAFE_INTEGER)
9007199254740992.0.0   -- rejected (exceeds safe integer range)
```

### Empty Range String

An empty string parses to a range matching all versions (`>=0.0.0`):

```typescript
import { Effect } from "effect";
import { Range } from "semver-effect";

const program = Effect.gen(function* () {
  const range = yield* Range.fromString("");
  // Equivalent to "*" -- matches everything
});
```

### Whitespace Handling

Leading and trailing whitespace is trimmed from version strings and range
expressions. Internal whitespace within a version string is not allowed:

```text
"  1.0.0  "     -- valid (trimmed to "1.0.0")
"1 .0.0"        -- invalid (internal space)
">=1.0.0 <2.0.0" -- valid (space separates comparators in a range)
```
