# SemVer 2.0.0 Specification Analysis

Research document for the semver-effect implementation. All grammar rules,
precedence logic, edge cases, and test vectors are extracted directly from
the authoritative specification at <https://semver.org> (SemVer 2.0.0).

---

## Table of Contents

1. [Complete BNF Grammar](#1-complete-bnf-grammar)
2. [Precedence Rules (Section 11)](#2-precedence-rules-section-11)
3. [Edge Cases and Subtleties](#3-edge-cases-and-subtleties)
4. [Spec Requirements vs Common Extensions](#4-spec-requirements-vs-common-extensions)
5. [Implementation Recommendations](#5-implementation-recommendations)
6. [Test Vectors from the Spec](#6-test-vectors-from-the-spec)

---

## 1. Complete BNF Grammar

The following is the verbatim BNF grammar from the SemVer 2.0.0
specification. This is what our recursive descent parser must implement
exactly for version strings. Range grammar is a node-semver extension
(see Section 4).

### Top-Level Production

```bnf
<valid semver> ::= <version core>
                 | <version core> "-" <pre-release>
                 | <version core> "+" <build>
                 | <version core> "-" <pre-release> "+" <build>
```

**Key observation:** The four alternatives encode exactly the combinations
of optional pre-release and build metadata. The "-" and "+" are literal
delimiter characters, not part of any identifier. The order is fixed:
pre-release MUST come before build metadata when both are present.

### Version Core

```bnf
<version core> ::= <major> "." <minor> "." <patch>

<major> ::= <numeric identifier>
<minor> ::= <numeric identifier>
<patch> ::= <numeric identifier>
```

All three components are mandatory. There is no valid semver with only
major, or major.minor. The dots are literal "." characters.

### Numeric Identifiers

```bnf
<numeric identifier> ::= "0"
                       | <positive digit>
                       | <positive digit> <digits>
```

**Critical rule: No leading zeros.** The only way to produce a numeric
identifier starting with "0" is the literal single character "0". Multi-digit
numbers MUST start with a positive digit. This means "00", "01", "001" are
all INVALID numeric identifiers.

### Pre-release

```bnf
<pre-release> ::= <dot-separated pre-release identifiers>

<dot-separated pre-release identifiers>
    ::= <pre-release identifier>
      | <pre-release identifier> "." <dot-separated pre-release identifiers>

<pre-release identifier> ::= <alphanumeric identifier>
                           | <numeric identifier>
```

Pre-release is a non-empty, dot-separated list of identifiers. Each
identifier is either:

- A **numeric identifier** (digits only, no leading zeros) -- compared as
  an integer in precedence
- An **alphanumeric identifier** (contains at least one non-digit) --
  compared lexically as ASCII

The distinction between numeric and alphanumeric is critical for precedence
(Section 11.4).

### Build Metadata

```bnf
<build> ::= <dot-separated build identifiers>

<dot-separated build identifiers>
    ::= <build identifier>
      | <build identifier> "." <dot-separated build identifiers>

<build identifier> ::= <alphanumeric identifier>
                     | <digits>
```

**Key difference from pre-release:** Build identifiers use `<digits>` rather
than `<numeric identifier>`. This means build identifiers DO allow leading
zeros (e.g., `001` is a valid build identifier but NOT a valid pre-release
numeric identifier). Build metadata has no precedence semantics, so the
leading-zero distinction is irrelevant for ordering but important for
parsing validation.

### Alphanumeric Identifiers

```bnf
<alphanumeric identifier> ::= <non-digit>
                             | <non-digit> <identifier characters>
                             | <identifier characters> <non-digit>
                             | <identifier characters> <non-digit> <identifier characters>
```

An alphanumeric identifier is any non-empty sequence of identifier
characters that contains **at least one non-digit**. The four alternatives
in the grammar are a formal way of expressing "one or more identifier
characters with at least one non-digit somewhere in the string."

**Practical implementation:** Parse a sequence of `[0-9A-Za-z-]` characters.
If all characters are digits, it is a numeric identifier; if any character is
a letter or hyphen, it is an alphanumeric identifier.

### Character-Level Productions

```bnf
<identifier characters> ::= <identifier character>
                          | <identifier character> <identifier characters>

<identifier character> ::= <digit>
                         | <non-digit>

<non-digit> ::= <letter>
              | "-"

<digits> ::= <digit>
           | <digit> <digits>

<digit> ::= "0"
          | <positive digit>

<positive digit> ::= "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

<letter> ::= "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
           | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T"
           | "U" | "V" | "W" | "X" | "Y" | "Z" | "a" | "b" | "c" | "d"
           | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n"
           | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x"
           | "y" | "z"
```

**Valid identifier characters:** Exactly `[0-9A-Za-z-]` (63 characters).
No underscores, no dots (dots are separators), no other punctuation.

### Grammar Summary for Implementation

The recursive descent parser needs these functions:

| Grammar Production | Parser Function | Returns |
| :--- | :--- | :--- |
| `<valid semver>` | `parseValidSemVer` | `SemVer` |
| `<version core>` | `parseVersionCore` | `[major, minor, patch]` |
| `<numeric identifier>` | `parseNumericIdentifier` | `number` |
| `<pre-release>` | `parsePreRelease` | `Array<string \| number>` |
| `<build>` | `parseBuild` | `Array<string>` |
| `<pre-release identifier>` | `parsePreReleaseIdentifier` | `string \| number` |
| `<build identifier>` | `parseBuildIdentifier` | `string` |
| `<alphanumeric identifier>` | (subsumed by identifier parsing) | `string` |
| `<digits>` | (subsumed by numeric parsing) | -- |

---

## 2. Precedence Rules (Section 11)

Section 11 of the SemVer 2.0.0 specification defines version precedence
(comparison/ordering). These rules are normative (use MUST).

### 11.1: Separation into Components

> Precedence MUST be calculated by separating the version into major,
> minor, patch and pre-release identifiers in that order (Build metadata
> does not figure into precedence).

**Implementation note:** Build metadata MUST be completely ignored in all
comparison and equality operations. Two versions differing only in build
metadata are equal and have the same precedence.

### 11.2: Numeric Comparison of Core Components

> Precedence is determined by the first difference when comparing each of
> these identifiers from left to right as follows: Major, minor, and patch
> versions are always compared numerically.

Example from spec: `1.0.0 < 2.0.0 < 2.1.0 < 2.1.1`

**Implementation:** Compare major first; if equal, compare minor; if equal,
compare patch. All as integer comparisons.

### 11.3: Pre-release vs Normal Version

> When major, minor, and patch are equal, a pre-release version has lower
> precedence than a normal version.

Example from spec: `1.0.0-alpha < 1.0.0`

**Implementation:** When major.minor.patch are equal:

- If `a` has prerelease and `b` does not: `a < b`
- If `a` does not have prerelease and `b` does: `a > b`
- If neither has prerelease: they are equal (ignoring build)
- If both have prerelease: proceed to 11.4

### 11.4: Pre-release Precedence

> Precedence for two pre-release versions with the same major, minor, and
> patch version MUST be determined by comparing each dot separated identifier
> from left to right until a difference is found as follows:

#### 11.4.1: Numeric Comparison

> Identifiers consisting of only digits are compared numerically.

Example: `1` vs `2` -> compare as integers, `1 < 2`

This is why numeric prerelease identifiers should be stored as `number`:
string comparison of `"9"` vs `"10"` would give `"9" > "10"` (wrong).

#### 11.4.2: Lexical Comparison

> Identifiers with letters or hyphens are compared lexically in ASCII
> sort order.

Example: `"alpha"` vs `"beta"` -> ASCII comparison, `"alpha" < "beta"`

**ASCII sort order** means byte-by-byte comparison. Uppercase letters
(65-90) sort before lowercase letters (97-122). So `"A" < "a"` and
`"Beta" < "alpha"`. This matches JavaScript's default string comparison
(`<` operator on strings).

#### 11.4.3: Numeric < Alphanumeric

> Numeric identifiers always have lower precedence than non-numeric
> identifiers.

Example: `1` vs `"alpha"` -> `1 < "alpha"` (numeric always loses)

**Implementation:** When comparing two identifiers of different types
(one is number, one is string), the number always has lower precedence
regardless of values.

#### 11.4.4: Length Tiebreaker

> A larger set of pre-release fields has a higher precedence than a
> smaller set, if all of the preceding identifiers are equal.

Example: `["alpha"]` vs `["alpha", 1]` -> `["alpha"] < ["alpha", 1]`

**Implementation:** When all identifiers in the shorter array match the
corresponding identifiers in the longer array, the shorter array has lower
precedence. This is a "prefix" rule -- if one prerelease is a prefix of
another, the prefix is smaller.

### Spec Example: Complete Precedence Chain

> 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
> < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0

Breaking down why each step holds:

| Left | Right | Rule |
| :--- | :--- | :--- |
| `1.0.0-alpha` | `1.0.0-alpha.1` | 11.4.4: `["alpha"]` is prefix of `["alpha", 1]` |
| `1.0.0-alpha.1` | `1.0.0-alpha.beta` | 11.4.3: `1` (numeric) < `"beta"` (alphanumeric) at index 1 |
| `1.0.0-alpha.beta` | `1.0.0-beta` | 11.4.2: `"alpha"` < `"beta"` lexically at index 0 |
| `1.0.0-beta` | `1.0.0-beta.2` | 11.4.4: `["beta"]` is prefix of `["beta", 2]` |
| `1.0.0-beta.2` | `1.0.0-beta.11` | 11.4.1: `2 < 11` numerically at index 1 |
| `1.0.0-beta.11` | `1.0.0-rc.1` | 11.4.2: `"beta"` < `"rc"` lexically at index 0 |
| `1.0.0-rc.1` | `1.0.0` | 11.3: prerelease < normal |

### Comparison Algorithm Pseudocode

```text
compare(a, b):
  if a.major != b.major: return sign(a.major - b.major)
  if a.minor != b.minor: return sign(a.minor - b.minor)
  if a.patch != b.patch: return sign(a.patch - b.patch)

  # Both have no prerelease -> equal
  if a.prerelease.empty && b.prerelease.empty: return 0

  # One has prerelease, other doesn't
  if a.prerelease.empty: return 1   # a is normal, b has pre -> a > b
  if b.prerelease.empty: return -1  # b is normal, a has pre -> a < b

  # Both have prerelease: compare element by element
  for i in 0..min(a.prerelease.length, b.prerelease.length):
    ai = a.prerelease[i]
    bi = b.prerelease[i]
    if ai == bi: continue

    # Both numeric
    if typeof(ai) == number && typeof(bi) == number:
      return sign(ai - bi)

    # Both string
    if typeof(ai) == string && typeof(bi) == string:
      return ai < bi ? -1 : 1

    # Mixed: numeric < string
    if typeof(ai) == number: return -1
    return 1

  # All shared identifiers equal, shorter is less
  return sign(a.prerelease.length - b.prerelease.length)
```

---

## 3. Edge Cases and Subtleties

### 3.1: Leading Zeros in Numeric Identifiers

**Spec clause 2:** "A normal version number MUST take the form X.Y.Z where
X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."

**Spec clause 9:** "Numeric identifiers MUST NOT include leading zeroes."

**BNF enforcement:** `<numeric identifier> ::= "0" | <positive digit> | <positive digit> <digits>`

This means:

- `0` is valid (it is exactly the literal "0")
- `00` is INVALID (two characters, starts with "0")
- `01` is INVALID (two characters, starts with "0")
- `0123` is INVALID
- `10` is valid (starts with positive digit)

**Applies to:** major, minor, patch, AND pre-release numeric identifiers.

**Does NOT apply to:** Build metadata identifiers. The build grammar uses
`<digits>` (not `<numeric identifier>`), so `001` is valid as a build
identifier. See spec clause 10 example: `1.0.0-alpha+001`.

### 3.2: Empty Identifiers

**Spec clause 9:** "Identifiers MUST NOT be empty."
**Spec clause 10:** "Identifiers MUST NOT be empty."

This means:

- `1.0.0-` is INVALID (empty pre-release after hyphen)
- `1.0.0+` is INVALID (empty build after plus)
- `1.0.0-.beta` is INVALID (empty first identifier)
- `1.0.0-beta.` is INVALID (empty last identifier -- trailing dot)
- `1.0.0-beta..1` is INVALID (empty middle identifier -- double dot)
- `1.0.0+.` is INVALID (empty build identifiers)

**Implementation:** After consuming "-" or "+", MUST find at least one valid
identifier character before encountering ".", "+", or end of input.

### 3.3: Valid Identifier Characters

**Exactly:** `[0-9A-Za-z-]`

Characters that are NOT valid:

- Underscore `_` -- not in the spec alphabet
- Space ` ` -- not valid
- Dot `.` -- separator, not an identifier character
- Plus `+` -- delimiter for build metadata
- Any other punctuation or Unicode

**The hyphen `-` IS a valid identifier character.** This is sometimes
surprising. The spec explicitly lists it: `<non-digit> ::= <letter> | "-"`.
This means pre-release identifiers like `x-y-z` and `--` are valid
alphanumeric identifiers.

Spec example confirming this: `1.0.0-x-y-z.--` (from clause 9 examples).

### 3.4: The "-" and "+" Delimiters

**Hyphen "-" has dual meaning:**

1. As a delimiter between version-core and pre-release (`1.0.0-alpha`)
2. As a valid character within identifiers (`alpha-beta`, `x-y-z`)

The parser must handle this by context: the first `-` after version-core
is the delimiter; subsequent `-` characters within identifiers are part of
the identifier.

**Plus "+" has single meaning:**

1. As a delimiter between pre-release (or version-core) and build metadata

There is only ever one `+` delimiter. Everything after the first `+` through
end of string is build metadata (dot-separated identifiers).

**Ordering of delimiters:** Pre-release ("-") MUST come before build ("+")
when both are present. `1.0.0+build-alpha` is valid -- the `-` after `+`
is part of a build identifier, not a pre-release delimiter.

### 3.5: Version 0.x.y Semantics

**Spec clause 4:** "Major version zero (0.y.z) is for initial development.
Anything MAY change at any time. The public API SHOULD NOT be considered
stable."

This is a semantic rule, not a parsing rule. Versions like `0.1.0`,
`0.0.1`, `0.0.0` are all syntactically valid. The parser does not treat
them differently. However, it matters for range matching behavior in
node-semver (caret ranges on 0.x.y have different semantics).

### 3.6: Integer Overflow

The spec says "non-negative integers" with no upper bound. However,
practical implementations must handle this. JavaScript's `Number.MAX_SAFE_INTEGER`
is `2^53 - 1` (9007199254740991). Version numbers exceeding this would lose
precision.

**Recommendation:** Accept any valid non-negative integer string during
parsing. Use JavaScript `Number()` for conversion. If the result is not a
safe integer (`Number.isSafeInteger()`), reject with an error. This provides
a practical limit while remaining spec-compliant for all realistic versions.

### 3.7: "v" Prefix

**From the FAQ:** 'Is "v1.2.3" a semantic version? No, "v1.2.3" is not a
semantic version.'

Our strict parser MUST reject `v1.2.3` and `V1.2.3`. The `v` prefix is a
common convention (especially in git tags) but is NOT part of the SemVer
spec. A tolerant/coerce mode could be added as a separate function.

### 3.8: Whitespace

The spec does not mention whitespace within version strings. No whitespace
is permitted anywhere in a valid semver string. `1.0.0`, `1.0.0`,
`1 .0.0`, `1.0.0- alpha` are all invalid.

**For range parsing** (node-semver extension), leading/trailing whitespace
on the full input is typically trimmed, and spaces separate comparators.

### 3.9: Case Sensitivity

The spec grammar includes both uppercase and lowercase letters. Identifier
comparison in precedence uses "ASCII sort order" which is case-sensitive.
This means:

- `1.0.0-Alpha` and `1.0.0-alpha` are different versions
- `1.0.0-Alpha < 1.0.0-alpha` (uppercase 'A' = 65, lowercase 'a' = 97)

There is no case folding or normalization.

### 3.10: Maximum Version Components

The spec requires exactly three numeric components: MAJOR.MINOR.PATCH.
These are all INVALID:

- `1` (missing minor and patch)
- `1.0` (missing patch)
- `1.0.0.0` (too many components)

---

## 4. Spec Requirements vs Common Extensions

### What IS in SemVer 2.0.0

- Version format: `MAJOR.MINOR.PATCH[-prerelease][+build]`
- BNF grammar for valid version strings
- Precedence/ordering rules (Section 11)
- Semantic rules for when to increment which component (Sections 4-8)
- Pre-release and build metadata syntax and semantics (Sections 9-10)

### What is NOT in SemVer 2.0.0 (node-semver extensions)

The following are all **node-semver conventions** and not part of the
SemVer 2.0.0 specification:

| Concept | Example | Source |
| :--- | :--- | :--- |
| **Ranges** | `>=1.0.0 <2.0.0` | node-semver |
| **Tilde ranges** | `~1.2.3` | node-semver |
| **Caret ranges** | `^1.2.3` | node-semver |
| **X-ranges** | `1.x`, `1.2.*` | node-semver |
| **Hyphen ranges** | `1.2.3 - 2.3.4` | node-semver |
| **OR unions** | `>=1.0.0 \|\| >=2.0.0` | node-semver |
| **Comparator operators** | `>`, `>=`, `<`, `<=`, `=` | node-semver |
| **Partial versions** | `1`, `1.2` | node-semver (as range input) |
| **`v` prefix tolerance** | `v1.2.3` | common convention |
| **Coercion** | `"v1"` -> `1.0.0` | node-semver |
| **`satisfies()` function** | -- | node-semver |
| **`-0` upper bound trick** | `<2.0.0-0` | node-semver |
| **Prerelease tag filtering** | Only match same M.m.p | node-semver policy |

### Implications for semver-effect

Our implementation has two distinct layers:

1. **Strict SemVer 2.0.0 layer** -- Version parsing, formatting, ordering,
   and equality. This MUST conform exactly to the spec.

2. **Range/matching layer** -- Range parsing, desugaring, satisfies logic.
   This follows node-semver conventions and is NOT governed by the SemVer
   spec. It should be clearly documented as an extension.

The parser design doc already captures this separation well. The
`parseVersion` function implements the spec grammar; `parseRange` implements
node-semver range grammar.

### Notable node-semver Behaviors Not in Spec

**Prerelease filtering in ranges:** node-semver has a policy that a
prerelease version only satisfies a range comparator if it shares the same
`[major, minor, patch]` tuple with the comparator version. For example,
`3.0.0-beta.1` satisfies `>=3.0.0-alpha.1` but does NOT satisfy `>=2.9.0`
even though `3.0.0-beta.1 > 2.9.0` by precedence. This is a policy choice,
not a spec requirement. Our operations.md already documents this.

**The `-0` trick:** When desugaring range sugar like `^1.2.3` to
`>=1.2.3 <2.0.0-0`, the `-0` prerelease on the upper bound ensures that
prerelease versions of `2.0.0` are excluded. The identifier `0` is the
lowest possible prerelease identifier (numeric `0` < any other identifier),
so `<2.0.0-0` means "less than the absolute minimum prerelease of 2.0.0",
which effectively means "less than 2.0.0 but not including any 2.0.0
prereleases." This relies on the precedence rule that numeric identifiers
have lower precedence than alphanumeric ones.

---

## 5. Implementation Recommendations

### 5.1: Numeric Identifiers as Numbers vs Strings

**Recommendation: Store numeric prerelease identifiers as `number`.**

Reasons:

- Spec Section 11.4.1 requires numeric comparison as integers
- String comparison of `"9"` vs `"10"` yields wrong result (`"9" > "10"`)
- Effect Schema's `NonNegativeInt` brand captures the constraint precisely
- The data-model.md already specifies `ReadonlyArray<string | number>`

**Store build identifiers as strings only.** Build metadata has no ordering
semantics. Even `001` should remain `"001"` (preserving leading zeros).
The data-model.md already specifies `ReadonlyArray<string>`.

**Store major/minor/patch as `number`.** The spec says "non-negative
integers." JavaScript `number` is sufficient for all practical version
numbers (safe up to 2^53 - 1).

### 5.2: Parser Strategy

**Recommendation: Single-pass, character-by-character, no regex.**

The BNF grammar maps directly to recursive descent:

1. Parse `<numeric identifier>` for major, expect ".", repeat for minor
   and patch.
2. If next char is "-", parse `<pre-release>` as dot-separated identifiers.
3. If next char is "+", parse `<build>` as dot-separated identifiers.
4. Expect end of input.

**Identifier type detection:** When parsing a pre-release identifier,
consume all `[0-9A-Za-z-]` characters. Then:

- If all characters are digits: it is a numeric identifier. Check for
  leading zeros (length > 1 and first char is "0" -> error). Parse as
  integer.
- If any character is a letter or hyphen: it is an alphanumeric identifier.
  Store as string.

This avoids the complexity of the four-alternative `<alphanumeric identifier>`
grammar production while producing identical results.

### 5.3: Efficient Comparison

**Recommendation: Inline numeric comparison, avoid allocations.**

The comparison function is called frequently (sorting, range matching).
Keep it tight:

```typescript
// Pseudocode for Order<SemVer>
const SemVerOrder = Order.make<SemVer>((a, b) => {
  // Fast path: numeric fields
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1

  const aLen = a.prerelease.length
  const bLen = b.prerelease.length

  // No prerelease on either -> equal
  if (aLen === 0 && bLen === 0) return 0

  // Prerelease vs normal
  if (aLen === 0) return 1   // a is release, higher precedence
  if (bLen === 0) return -1  // b is release, higher precedence

  // Compare prerelease identifiers
  const len = Math.min(aLen, bLen)
  for (let i = 0; i < len; i++) {
    const ai = a.prerelease[i]
    const bi = b.prerelease[i]
    if (ai === bi) continue

    const aNum = typeof ai === "number"
    const bNum = typeof bi === "number"

    if (aNum && bNum) return (ai as number) < (bi as number) ? -1 : 1
    if (aNum) return -1  // numeric < alphanumeric
    if (bNum) return 1   // alphanumeric > numeric
    return (ai as string) < (bi as string) ? -1 : 1
  }

  // Prefix match -> shorter is less
  if (aLen !== bLen) return aLen < bLen ? -1 : 1
  return 0
})
```

**Performance notes:**

- No object allocation in the hot path
- Type checks via `typeof` are JIT-optimized in V8
- Early returns for the common case (different major/minor/patch)
- The prerelease loop only executes when core versions are identical

### 5.4: Immutability

**Recommendation: Leverage Schema.TaggedClass freezing.**

Schema.TaggedClass instances are frozen by default. The `prerelease` and
`build` arrays should use `ReadonlyArray` at the type level. Since the
underlying arrays are frozen, `Object.freeze` is already applied.

For bump operations, always construct a new instance:

```typescript
// Good: new instance
SemVer.bump.major(v) // returns new SemVer(...)

// The original v is never modified
```

Do NOT use `structuredClone` for bump operations -- constructing a new
Schema.TaggedClass instance is more explicit and avoids cloning the `_tag`
and prototype chain incorrectly. Just use `new SemVer({...})` or the make
function.

### 5.5: Equality and Hashing

**Recommendation: Override Equal.symbol to exclude build metadata.**

The spec is unambiguous: "Two versions that differ only in the build
metadata, have the same precedence." For Effect's `Equal` trait, this means:

```typescript
[Equal.symbol](that: SemVer): boolean {
  return this.major === that.major
    && this.minor === that.minor
    && this.patch === that.patch
    && this.prerelease.length === that.prerelease.length
    && this.prerelease.every((v, i) => v === that.prerelease[i])
}
```

**Hash must be consistent with Equal.** Hash only major, minor, patch, and
prerelease. Do NOT include build metadata in the hash.

### 5.6: String Formatting

**Recommendation: Single-pass string construction.**

```text
format(v: SemVer): string {
  let s = `${v.major}.${v.minor}.${v.patch}`
  if (v.prerelease.length > 0) s += `-${v.prerelease.join(".")}`
  if (v.build.length > 0) s += `+${v.build.join(".")}`
  return s
}
```

This produces spec-compliant output that round-trips through the parser.

---

## 6. Test Vectors from the Spec

### 6.1: Valid Version Strings (from spec examples)

These appear directly in the specification text and MUST parse successfully:

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

**Parsed representations:**

| String | major | minor | patch | prerelease | build |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `1.0.0-alpha` | 1 | 0 | 0 | `["alpha"]` | `[]` |
| `1.0.0-alpha.1` | 1 | 0 | 0 | `["alpha", 1]` | `[]` |
| `1.0.0-0.3.7` | 1 | 0 | 0 | `[0, 3, 7]` | `[]` |
| `1.0.0-x.7.z.92` | 1 | 0 | 0 | `["x", 7, "z", 92]` | `[]` |
| `1.0.0-x-y-z.--` | 1 | 0 | 0 | `["x-y-z", "--"]` | `[]` |
| `1.0.0-alpha+001` | 1 | 0 | 0 | `["alpha"]` | `["001"]` |
| `1.0.0+20130313144700` | 1 | 0 | 0 | `[]` | `["20130313144700"]` |
| `1.0.0-beta+exp.sha.5114f85` | 1 | 0 | 0 | `["beta"]` | `["exp", "sha", "5114f85"]` |
| `1.0.0+21AF26D3----117B344092BD` | 1 | 0 | 0 | `[]` | `["21AF26D3----117B344092BD"]` |

**Note on `1.0.0-x-y-z.--`:** The prerelease identifiers are `"x-y-z"` and
`"--"`. Both contain hyphens, making them alphanumeric identifiers. The
`"--"` identifier is particularly interesting -- it consists entirely of
hyphens, which are non-digits, making it a valid alphanumeric identifier.

**Note on `1.0.0+21AF26D3----117B344092BD`:** The build metadata is a single
identifier (no dots) containing uppercase letters, digits, and hyphens. The
four consecutive hyphens are valid identifier characters.

### 6.2: Precedence Test Vector (from Section 11)

The spec provides this exact ordering chain:

```text
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
< 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
```

This gives us 28 ordered pair tests (every combination of i < j):

```text
1.0.0-alpha     < 1.0.0-alpha.1
1.0.0-alpha     < 1.0.0-alpha.beta
1.0.0-alpha     < 1.0.0-beta
1.0.0-alpha     < 1.0.0-beta.2
1.0.0-alpha     < 1.0.0-beta.11
1.0.0-alpha     < 1.0.0-rc.1
1.0.0-alpha     < 1.0.0
1.0.0-alpha.1   < 1.0.0-alpha.beta
1.0.0-alpha.1   < 1.0.0-beta
1.0.0-alpha.1   < 1.0.0-beta.2
1.0.0-alpha.1   < 1.0.0-beta.11
1.0.0-alpha.1   < 1.0.0-rc.1
1.0.0-alpha.1   < 1.0.0
1.0.0-alpha.beta < 1.0.0-beta
1.0.0-alpha.beta < 1.0.0-beta.2
1.0.0-alpha.beta < 1.0.0-beta.11
1.0.0-alpha.beta < 1.0.0-rc.1
1.0.0-alpha.beta < 1.0.0
1.0.0-beta      < 1.0.0-beta.2
1.0.0-beta      < 1.0.0-beta.11
1.0.0-beta      < 1.0.0-rc.1
1.0.0-beta      < 1.0.0
1.0.0-beta.2    < 1.0.0-beta.11
1.0.0-beta.2    < 1.0.0-rc.1
1.0.0-beta.2    < 1.0.0
1.0.0-beta.11   < 1.0.0-rc.1
1.0.0-beta.11   < 1.0.0
1.0.0-rc.1      < 1.0.0
```

### 6.3: Additional Precedence Examples (from Section 11.2)

```text
1.0.0 < 2.0.0 < 2.1.0 < 2.1.1
```

### 6.4: Equality Test Vectors (from spec semantics)

Build metadata MUST be ignored. These pairs MUST be equal:

```text
1.0.0-alpha+001       == 1.0.0-alpha+002
1.0.0+20130313144700  == 1.0.0+different-build
1.0.0+build1          == 1.0.0+build2
1.0.0-beta+exp.sha.5114f85 == 1.0.0-beta+exp.sha.other
```

### 6.5: Invalid Version Strings (from spec rules)

These MUST be rejected by a strict parser:

| Input | Reason | Spec Rule |
| :--- | :--- | :--- |
| `1` | Missing minor and patch | Clause 2 |
| `1.0` | Missing patch | Clause 2 |
| `1.0.0.0` | Extra component | Grammar |
| `01.0.0` | Leading zero in major | Clause 2 |
| `1.01.0` | Leading zero in minor | Clause 2 |
| `1.0.01` | Leading zero in patch | Clause 2 |
| `1.0.0-` | Empty prerelease | Clause 9 |
| `1.0.0+` | Empty build | Clause 10 |
| `1.0.0-beta.` | Trailing dot in prerelease | Clause 9 |
| `1.0.0+build.` | Trailing dot in build | Clause 10 |
| `1.0.0-beta..1` | Empty identifier (double dot) | Clause 9 |
| `1.0.0-01` | Leading zero in numeric prerelease | Clause 9 |
| `1.0.0-beta!` | Invalid character `!` | Grammar |
| `1.0.0-beta_1` | Invalid character `_` | Grammar |
| `v1.0.0` | `v` prefix not in grammar | FAQ |
| `=1.0.0` | `=` prefix not in grammar | Grammar |
| `1.0.0` | Leading whitespace | Grammar |
| `1.0.0` | Trailing whitespace | Grammar |
| `-1.0.0` | Negative number | Grammar |
| `1.0.0-alpha+` | Empty build after `+` | Clause 10 |
| `1.0.0-alpha+build+extra` | Second `+` not valid | Grammar* |
| `1.0.0--` | Prerelease `"-"` is valid alphanumeric identifier | VALID (not invalid!) |

*Note on `1.0.0-alpha+build+extra`: The `+` within build metadata IS a valid
question. Looking at the grammar: `<build identifier> ::= <alphanumeric identifier> | <digits>`,
and the `+` character is NOT in `[0-9A-Za-z-]`. So after the first `+`, the
parser enters build mode. The second `+` would be an invalid character in
a build identifier. This string IS invalid.

**Watch out:** `1.0.0--` is VALID. The prerelease is a single identifier
`"-"` which is a non-digit (hyphen), making it a valid alphanumeric
identifier.

### 6.6: Tricky Valid Strings (for parser robustness)

These are valid but might trip up a naive parser:

```text
0.0.0                          # All zeros
0.0.0-0                        # Zero prerelease identifier
0.0.0-0.0.0                    # All-zero prerelease identifiers
1.0.0--                        # Hyphen-only prerelease identifier
1.0.0---                       # Multiple hyphens as prerelease
1.0.0-0alpha                   # Starts with digit but contains letter -> alphanumeric
1.0.0-alpha0                   # Ends with digit but contains letter -> alphanumeric
1.0.0-0-0                      # Starts with zero, contains hyphen -> alphanumeric (NOT leading zero error)
1.0.0-alpha.0                  # Mixed: alphanumeric then numeric identifier
1.0.0-alpha.-1                 # "-1" contains hyphen -> alphanumeric identifier, valid
1.0.0-alpha.---                # "---" is all hyphens -> valid alphanumeric
1.0.0+0                        # Build with leading zero -> valid (build allows <digits>)
1.0.0+001                      # Build with leading zeros -> valid
1.0.0+00                       # Build "00" -> valid (digits, not numeric identifier)
999999999.999999999.999999999   # Large numbers
1.0.0-alpha.1.2.3.4.5.6.7.8.9 # Many prerelease identifiers
```

**Critical edge case: `1.0.0-0alpha`**

This starts with "0" but contains a letter, so it is an alphanumeric
identifier, NOT a numeric identifier with a leading zero. The
leading-zero rule only applies to identifiers that consist ENTIRELY of
digits. The parser must consume all `[0-9A-Za-z-]` characters before
deciding whether an identifier is numeric or alphanumeric.

**Critical edge case: `1.0.0-0-0`**

Similar to above. Contains a hyphen, so it is an alphanumeric identifier.
NOT a numeric identifier. No leading-zero violation.

### 6.7: Regex from the Spec FAQ

The spec FAQ provides two official regexes for validation. The ECMA Script
compatible version:

```text
^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$
```

Capture groups:

- Group 1: major
- Group 2: minor
- Group 3: patch
- Group 4: prerelease (full string, needs dot-splitting)
- Group 5: build metadata (full string, needs dot-splitting)

**We are NOT using this regex** (our parser is recursive descent), but it
serves as a validation oracle for our test suite. Any string accepted by
this regex should also be accepted by our parser, and vice versa.

---

## Appendix A: Spec Section Reference

For quick lookup, here are the normative sections:

| Section | Topic |
| :--- | :--- |
| 1 | MUST declare a public API |
| 2 | Version format X.Y.Z, no leading zeros |
| 3 | Released versions are immutable |
| 4 | 0.y.z is initial development |
| 5 | 1.0.0 defines the public API |
| 6 | Patch version Z for backward-compatible bug fixes |
| 7 | Minor version Y for backward-compatible functionality |
| 8 | Major version X for incompatible changes |
| 9 | Pre-release: hyphen + dot-separated identifiers |
| 10 | Build metadata: plus + dot-separated identifiers |
| 11 | Precedence rules (comparison/ordering) |

Sections 1-8 are semantic (about when to bump), not syntactic. They do not
affect parsing or comparison logic. Sections 9-11 plus the BNF grammar are
what our parser and comparison code must implement.

---

## Appendix B: Discrepancies Between Our Design Docs and Spec

After reviewing our design docs against the spec, these items should be
verified during implementation:

1. **parser.md grammar matches spec grammar:** The BNF in parser.md
   (Section "Version Grammar") matches the spec grammar verbatim. Confirmed
   correct.

2. **data-model.md prerelease type:** `ReadonlyArray<string | number>` is
   correct. Numeric identifiers as `number`, alphanumeric as `string`.

3. **data-model.md build type:** `ReadonlyArray<string>` is correct. Build
   identifiers are always strings (even digit-only ones like "001").

4. **operations.md precedence rules:** The documented rules in Section
   "Ordering Rules" match spec Section 11. Confirmed correct.

5. **data-model.md Schema.NonNegativeInt:** This is the correct brand for
   major/minor/patch. The spec says "non-negative integers" and the schema
   brand enforces `>= 0` and integer.

6. **parser.md "v prefix not accepted":** Correct per spec FAQ.

7. **operations.md prerelease matching policy:** The document notes that
   "a prerelease version only satisfies a range if at least one comparator
   in the matching set has the same [major, minor, patch] tuple." This is
   a node-semver policy, correctly identified as separate from the spec.

No discrepancies found between the design docs and the SemVer 2.0.0
specification.
