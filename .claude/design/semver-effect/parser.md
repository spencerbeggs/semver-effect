---
status: draft
module: semver-effect
category: architecture
created: 2026-03-10
updated: 2026-03-10
last-synced: never
completeness: 80
related:
  - architecture.md
  - data-model.md
  - error-model.md
dependencies:
  - data-model.md
  - error-model.md
---

# Parser System Design

Recursive descent parser for SemVer 2.0.0 version strings and range
expressions, exposed as an Effect service with typed error channels and
precise error positions.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Grammar Specification](#grammar-specification)
5. [Parsing Implementation Notes](#parsing-implementation-notes)
6. [Desugaring Rules](#desugaring-rules)
7. [Service API](#service-api)
8. [Internal Architecture](#internal-architecture)
9. [Error Handling](#error-handling)
10. [Tricky Valid Strings](#tricky-valid-strings)
11. [Related Documentation](#related-documentation)

---

## Overview

The parser is the primary entry point for all user input in semver-effect.
Every version string and range expression flows through the SemVerParser
service before becoming an immutable data type. The parser implements the
SemVer 2.0.0 BNF grammar via a hand-written recursive descent strategy,
walking the input character by character with no regex and no backtracking.

**Key properties:**

- Strict SemVer 2.0.0 grammar -- rejects anything that does not conform
- Character-by-character walk producing precise error positions
- All syntactic sugar (tilde, caret, x-range, hyphen) desugared to
  primitive ComparatorSets during parsing
- Exposed as an Effect service (SemVerParser) following the interface +
  GenericTag + Layer pattern
- Every parse operation returns an Effect with a typed error channel

**When to reference this document:**

- When implementing or modifying the recursive descent parser
- When adding new range syntax or desugaring rules
- When debugging parse errors or improving error messages
- When working on `src/utils/grammar.ts`, `src/utils/desugar.ts`, or
  `src/utils/normalize.ts`

---

## Current State

The parser system is not yet implemented. The design spec is approved and
the file structure is defined, but no source files have been written. This
document captures the full parser design to guide implementation.

### Planned File Structure

```text
src/
  services/
    SemVerParser.ts             -- Service interface + Context.GenericTag
  layers/
    SemVerParserLive.ts         -- Layer implementation (Layer.succeed)
  utils/
    grammar.ts                  -- BNF grammar rules, recursive descent
    desugar.ts                  -- Range sugar to primitive comparators
    normalize.ts                -- Normalization of parsed ranges
  schemas/
    SemVer.ts                   -- SemVer schema type
    Range.ts                    -- Range, ComparatorSet, Comparator schemas
  errors/
    InvalidVersionError.ts      -- Version parse error
    InvalidRangeError.ts        -- Range parse error
    InvalidComparatorError.ts   -- Comparator parse error
```

### Dependencies

The parser depends on:

- **Schema types** (`src/schemas/`) -- SemVer, Comparator, ComparatorSet,
  Range output types
- **Error types** (`src/errors/`) -- InvalidVersionError, InvalidRangeError,
  InvalidComparatorError (one file per error, split base pattern for
  api-extractor)
- **Effect** (Effect, Context, Layer) -- service infrastructure

---

## Rationale

### Why Recursive Descent

A recursive descent parser maps directly to the BNF grammar productions.
Each grammar rule becomes a function, and the parser walks the input left
to right without backtracking. This approach was chosen over regex for
three reasons:

1. **Precise error positions.** When parsing fails, the parser knows
   exactly which character caused the failure and which grammar production
   was being attempted. A regex match failure provides no position info.

2. **Maintainability.** The grammar functions mirror the BNF spec one to
   one. Adding a new production or modifying an existing one is a local
   change. Complex regex patterns are difficult to extend and debug.

3. **No backtracking.** The SemVer 2.0.0 grammar is LL(1) for version
   strings. Range expressions require at most one token of lookahead to
   disambiguate hyphen ranges from simple comparators. This keeps the
   parser linear in the input length.

### Why Desugar During Parsing

Syntactic sugar (tilde, caret, x-range, hyphen) is eliminated during
parsing rather than preserved in the AST. This means downstream code
(range matching, algebra, cache resolution) only needs to handle primitive
comparators with explicit operators. The tradeoff is that the original
syntax is not recoverable from the parsed Range, but this is acceptable
because:

- The input string is preserved in error types for diagnostics
- Range.toString() produces a canonical primitive form
- Simplifying the downstream API is worth losing the original sugar

### Why an Effect Service

The parser is stateless, but wrapping it as an Effect service provides:

- Consistent API pattern across the library (all services use interface +
  GenericTag + Layer)
- Dependency injection for testing (swap in a mock parser)
- Future extensibility (e.g., adding parser configuration or caching)

---

## Grammar Specification

The parser implements the following BNF grammar, derived from the SemVer
2.0.0 specification (<https://semver.org>) and the node-semver range syntax.

### Version Grammar

```bnf
<valid-semver> ::= <version-core>
                 | <version-core> "-" <pre-release>
                 | <version-core> "+" <build>
                 | <version-core> "-" <pre-release> "+" <build>

<version-core> ::= <major> "." <minor> "." <patch>

<major> ::= <numeric-identifier>
<minor> ::= <numeric-identifier>
<patch> ::= <numeric-identifier>

<numeric-identifier> ::= "0"
                       | <positive-digit>
                       | <positive-digit> <digits>

<positive-digit> ::= "1" | "2" | "3" | "4" | "5"
                    | "6" | "7" | "8" | "9"

<digits> ::= <digit>
            | <digit> <digits>

<digit> ::= "0" | <positive-digit>
```

### Pre-release and Build Grammar

```bnf
<pre-release> ::= <dot-separated-pre-release-identifiers>

<dot-separated-pre-release-identifiers>
    ::= <pre-release-identifier>
      | <pre-release-identifier> "."
        <dot-separated-pre-release-identifiers>

<pre-release-identifier> ::= <alphanumeric-identifier>
                            | <numeric-identifier>

<alphanumeric-identifier> ::= <non-digit>
                             | <non-digit> <identifier-characters>
                             | <identifier-characters> <non-digit>
                             | <identifier-characters> <non-digit>
                               <identifier-characters>

<identifier-characters> ::= <identifier-character>
                           | <identifier-character>
                             <identifier-characters>

<identifier-character> ::= <digit> | <non-digit>

<non-digit> ::= <letter> | "-"

<letter> ::= "A" | "B" | ... | "Z" | "a" | "b" | ... | "z"

<build> ::= <dot-separated-build-identifiers>

<dot-separated-build-identifiers>
    ::= <build-identifier>
      | <build-identifier> "."
        <dot-separated-build-identifiers>

<build-identifier> ::= <alphanumeric-identifier>
                      | <digits>
```

**Numeric identifier rule:** A numeric pre-release identifier must not
contain leading zeros. The identifier `"0"` is valid, but `"01"` or `"00"`
are not. Build identifiers allow leading zeros because the `<build>`
grammar uses `<digits>` (which permits any sequence of digits) rather than
`<numeric-identifier>` (which forbids leading zeros). This distinction is
important: `1.0.0-01` is invalid (pre-release leading zero) but
`1.0.0+001` is valid (build metadata leading zeros are fine).

**Build metadata `+` delimiter:** There is only ever one `+` delimiter in a
valid semver string. Everything after the first `+` through the end of the
string is build metadata. Build identifiers are dot-separated and each
identifier must match `[0-9A-Za-z-]+`. A second `+` character is not a
valid identifier character, so `1.0.0+build+extra` is rejected.

### Range Grammar

```bnf
<range-set> ::= <range>
              | <range> <logical-or> <range-set>

<logical-or> ::= " " "||" " "
               | " " "||"
               | "||" " "
               | "||"

<range> ::= <hyphen>
           | <simple> " " <range>
           | <simple>

<hyphen> ::= <partial> " " "-" " " <partial>

<simple> ::= <primitive>
            | <partial>
            | <tilde>
            | <caret>

<primitive> ::= <operator> <partial>
              | <partial>

<operator> ::= ">=" | "<=" | ">" | "<" | "="

<tilde> ::= "~" <partial>

<caret> ::= "^" <partial>
```

**`~>` (Ruby-style tilde) is NOT supported.** The `~>` operator originates
from Ruby/Bundler's "pessimistic version constraint" and is not part of the
SemVer 2.0.0 specification or node-semver's documented BNF grammar. Although
node-semver silently accepts `~>` as an undocumented legacy alias for `~`,
our parser explicitly rejects it. An input like `~>1.2.3` produces an
`InvalidRangeError` at the `>` character. If users intend tilde behavior,
they should write `~1.2.3`.

```bnf

<partial> ::= <xr>
            | <xr> "." <xr>
            | <xr> "." <xr> "." <xr> <qualifier>

<xr> ::= "x" | "X" | "*" | <numeric-identifier>

<qualifier> ::= <empty>
              | "-" <pre-release>
              | "+" <build>
              | "-" <pre-release> "+" <build>
```

### Partial Versions in Range Context

Partial versions -- versions with fewer than three numeric components -- are
accepted as range inputs and treated as x-range shorthand. This is a
node-semver convention that we adopt for range parsing only. Version parsing
(`parseVersion`) still requires all three components.

```text
1.2       equivalent to 1.2.x     desugars to >=1.2.0 <1.3.0-0
1         equivalent to 1.x.x     desugars to >=1.0.0 <2.0.0-0
*         matches any version      desugars to >=0.0.0
```

The `<partial>` production in the grammar already encodes this: `<xr>` alone
or `<xr> "." <xr>` (without a third component) are valid partial forms.
Missing components are treated as wildcards and follow the same desugaring
rules as explicit x-ranges. This means `1.2` and `1.2.x` produce identical
`ComparatorSet` output, as do `1` and `1.x.x`.

### Whitespace Rules

- Spaces between comparators in a set are significant (implicit AND)
- Spaces around `||` are optional
- Spaces around `-` in hyphen ranges are required (to disambiguate from
  pre-release separator)
- No other whitespace is permitted within a version string
- Leading and trailing whitespace on the full input is trimmed

---

## Parsing Implementation Notes

### Identifier Type Detection Strategy

The `<alphanumeric identifier>` grammar production has four alternatives,
but implementing them directly would require complex branching. Instead,
the parser uses a simpler two-phase approach:

1. **Consume** all characters matching `[0-9A-Za-z-]` to collect the full
   identifier string.
2. **Classify** the identifier after consumption: scan the collected string
   to check if any character is a non-digit (letter or hyphen). If every
   character is a digit, the identifier is numeric -- validate that it has
   no leading zeros (unless it is exactly `"0"`). If any character is a
   letter or hyphen, the identifier is alphanumeric -- leading zeros are
   irrelevant because it is not a numeric identifier.

This avoids implementing the four-alternative `<alphanumeric identifier>`
production and makes the code straightforward: consume first, classify
second. The key insight is that `0alpha` starts with `0` but contains a
letter, so it is alphanumeric and NOT a leading zero violation.

### Strict V-Prefix Rejection

Per the SemVer 2.0.0 specification FAQ, a `v` prefix is not part of
semantic versioning. The parser must reject `v1.2.3` and `V1.2.3` (both
cases). No stripping, no coercion. If the first character of the input
(after trimming whitespace) is `v` or `V`, the parser produces an
`InvalidVersionError` immediately. The error message should be explicit:
"version strings must not begin with 'v' prefix".

### Integer Overflow Validation

`parseNumericIdentifier` converts the consumed digit sequence to a number
via `Number()`. After conversion, the result must be checked with
`Number.isSafeInteger()`. If the value exceeds `Number.MAX_SAFE_INTEGER`
(2^53 - 1), the parser produces an error rather than silently losing
precision. This applies to major, minor, patch, and numeric pre-release
identifiers.

### No includePrerelease Option

Unlike node-semver, this library does not provide an `includePrerelease`
option at any level (parser, matching, or range evaluation). Pre-release
versions follow the strict same-tuple policy only: a pre-release version
like `1.2.3-alpha` is only matched by comparators whose version tuple is
exactly `1.2.3`. The range `>=1.2.0 <1.3.0` does not match `1.2.5-beta`
because the pre-release is on the `1.2.5` tuple, which is within the range
bounds but does not share a tuple with either comparator endpoint. There is
no flag to change this behavior. This is a deliberate design decision to
avoid the confusion and subtle bugs that `includePrerelease` causes in
node-semver.

### SemVer Construction with disableValidation

When the parser constructs a `SemVer` instance from successfully parsed
and validated components, it should pass `{ disableValidation: true }` to
the SemVer constructor. The parser has already validated all invariants
(no leading zeros, valid identifiers, safe integers), so re-validating
inside the constructor is redundant work. This avoids double validation
on the hot path.

---

## Desugaring Rules

All syntactic sugar is converted to primitive comparator sets during
parsing. The desugaring rules are applied by `src/utils/desugar.ts`.

### Tilde Ranges

Tilde allows patch-level changes if a minor version is specified, or
minor-level changes if only a major version is specified.

```text
~1.2.3    -->  >=1.2.3 <1.3.0-0
~1.2      -->  >=1.2.0 <1.3.0-0
~1        -->  >=1.0.0 <2.0.0-0
~0.2.3    -->  >=0.2.3 <0.3.0-0
```

**Rule:** `~M.m.p` expands to `>=M.m.p <M.(m+1).0-0`. When patch is
missing, it defaults to 0. When minor is missing, it expands to
`>=M.0.0 <(M+1).0.0-0`.

The `-0` suffix on the upper bound ensures that pre-release versions of
the upper bound are excluded, matching the SemVer precedence rules where
`1.3.0-alpha` is less than `1.3.0`.

### Caret Ranges

Caret allows changes that do not modify the leftmost non-zero component.

```text
^1.2.3    -->  >=1.2.3 <2.0.0-0
^0.2.3    -->  >=0.2.3 <0.3.0-0
^0.0.3    -->  >=0.0.3 <0.0.4-0
^1.2.x    -->  >=1.2.0 <2.0.0-0
^0.0.x    -->  >=0.0.0 <0.1.0-0
^0.0      -->  >=0.0.0 <0.1.0-0
^1.x      -->  >=1.0.0 <2.0.0-0
^0.x      -->  >=0.0.0 <1.0.0-0
```

**Rule:** Find the leftmost non-zero component among M, m, p (treating
missing/x as 0). Increment that component and zero everything to its
right for the upper bound.

### X-Ranges

An `x`, `X`, or `*` in any position acts as a wildcard.

```text
*         -->  >=0.0.0             (match everything)
1.x       -->  >=1.0.0 <2.0.0-0
1.2.x     -->  >=1.2.0 <1.3.0-0
1.x.x     -->  >=1.0.0 <2.0.0-0   (same as 1.x)
""        -->  >=0.0.0             (empty string = match everything)
```

**Rule:** Replace wildcards with 0 for the lower bound. For the upper
bound, increment the last non-wildcard component and zero the rest.
A fully wild range has no upper bound.

### Hyphen Ranges

Hyphen ranges specify an inclusive set.

```text
1.2.3 - 2.3.4    -->  >=1.2.3 <=2.3.4
1.2 - 2.3.4      -->  >=1.2.0 <=2.3.4
1.2.3 - 2.3      -->  >=1.2.3 <2.4.0-0
1.2.3 - 2        -->  >=1.2.3 <3.0.0-0
```

**Rule:** The lower bound is always `>=` with missing components defaulted
to 0. If the upper bound is a partial version (missing minor or patch),
the upper bound becomes `<` the next version at the missing level. If the
upper bound is a full version, the upper bound is `<=`.

### Implicit Equality

A bare version with no operator is treated as an exact match.

```text
1.2.3     -->  =1.2.3    (when used as a primitive, not a partial)
```

---

## Service API

### SemVerParser Service Definition

The service interface and tag are defined in `src/services/SemVerParser.ts`
using `Context.GenericTag` (not `Context.Tag` class, which produces
un-nameable `_base` types that break api-extractor). The layer
implementation lives in `src/layers/SemVerParserLive.ts`.

```typescript
// src/services/SemVerParser.ts
export interface SemVerParser {
  readonly parseVersion: (input: string) => Effect.Effect<SemVer, InvalidVersionError>;
  readonly parseRange: (input: string) => Effect.Effect<Range, InvalidRangeError>;
  readonly parseComparator: (input: string) => Effect.Effect<Comparator, InvalidComparatorError>;
}
export const SemVerParser = Context.GenericTag<SemVerParser>("SemVerParser");
```

```text
// src/layers/SemVerParserLive.ts
SemVerParserLive: Layer.Layer<SemVerParser>   (Layer.succeed)
```

### Methods

#### parseVersion

```text
parseVersion(input: string): Effect<SemVer, InvalidVersionError>
```

Parses a SemVer 2.0.0 version string into a SemVer instance. Rejects
any input that does not strictly conform to the `<valid-semver>` grammar
production. Leading `v` or `V` prefixes are rejected per the spec FAQ
(not stripped, not coerced -- rejected with an explicit error). Leading
`=` is also not accepted.

**Examples:**

```text
"1.2.3"             --> SemVer(1, 2, 3, [], [])
"1.0.0-alpha.1"     --> SemVer(1, 0, 0, ["alpha", 1], [])
"1.0.0+build.123"   --> SemVer(1, 0, 0, [], ["build", "123"])
"1.0.0-rc.1+sha.ab" --> SemVer(1, 0, 0, ["rc", 1], ["sha", "ab"])
"01.0.0"            --> InvalidVersionError (leading zero)
"v1.0.0"            --> InvalidVersionError (v prefix not allowed)
"1.0"               --> InvalidVersionError (patch required)
```

#### parseRange

```text
parseRange(input: string): Effect<Range, InvalidRangeError>
```

Parses a range expression into a Range instance. Applies all desugaring
rules during parsing. The resulting Range contains only primitive
comparators with explicit operators.

**Examples:**

```text
">=1.0.0 <2.0.0"   --> Range([[>=1.0.0, <2.0.0]])
"^1.2.3"            --> Range([[>=1.2.3, <2.0.0-0]])
"~1.2.3 || >=3.0.0" --> Range([[>=1.2.3, <1.3.0-0], [>=3.0.0]])
"*"                 --> Range([[>=0.0.0]])
"1.2.3 - 2.0.0"    --> Range([[>=1.2.3, <=2.0.0]])
```

#### parseComparator

```text
parseComparator(input: string): Effect<Comparator, InvalidComparatorError>
```

Parses a single comparator expression into a Comparator instance. Does
not accept unions or multi-comparator sets.

**Examples:**

```text
">=1.2.3"   --> Comparator(">=", SemVer(1, 2, 3))
"<2.0.0"    --> Comparator("<", SemVer(2, 0, 0))
"1.2.3"     --> Comparator("=", SemVer(1, 2, 3))
```

### Convenience Functions

In addition to the SemVerParser service, the library should export
standalone convenience functions that use a default parser internally:

```text
parseVersion(input: string): Effect<SemVer, InvalidVersionError>
parseRange(input: string): Effect<Range, InvalidRangeError>
parseComparator(input: string): Effect<Comparator, InvalidComparatorError>
```

These functions provide a simple API for common use cases without
requiring Layer composition or dependency injection. They internally
construct a default SemVerParser and delegate to its methods. The
SemVerParser service still exists for DI, testability, and cases where
users want to swap in a custom parser implementation.

---

## Internal Architecture

### Module Responsibilities

#### src/utils/grammar.ts

The core recursive descent parser. Contains one function per grammar
production, each consuming characters from a shared cursor position.

**Parser state:**

```text
ParserState
  input: string           -- original input (immutable)
  pos: number             -- current cursor position (mutable)
  len: number             -- input length (cached)
```

**Key functions:**

```text
parseValidSemVer(state): SemVer | ParseError
parseVersionCore(state): [major, minor, patch] | ParseError
parseNumericIdentifier(state): number | ParseError
parsePreRelease(state): ReadonlyArray<string | number> | ParseError
parseBuild(state): ReadonlyArray<string> | ParseError
parseRangeSet(state): Range | ParseError
parseRange(state): ComparatorSet | ParseError
parseHyphen(state): ComparatorSet | ParseError
parseSimple(state): ComparatorSet | ParseError
parsePrimitive(state): Comparator | ParseError
parsePartial(state): Partial | ParseError
parseOperator(state): Operator | null
parseTilde(state): ComparatorSet | ParseError
parseCaret(state): ComparatorSet | ParseError
parseXR(state): number | "x" | ParseError
```

**Character-level helpers:**

```text
peek(state): string | null        -- look at current char
advance(state): string | null     -- consume and return current char
expect(state, char): void | Error -- consume expected char or error
isDigit(char): boolean
isLetter(char): boolean
isIdentChar(char): boolean
atEnd(state): boolean
```

**Lookahead strategy:** The parser uses single-character lookahead for
most decisions. Hyphen range detection requires checking whether a space
followed by `-` followed by a space appears, which uses bounded lookahead
(three characters) without backtracking.

#### src/utils/desugar.ts

Converts parsed sugar forms into primitive comparator sets. Called by the
grammar functions when they recognize tilde, caret, x-range, or hyphen
syntax.

**Key functions:**

```text
desugarTilde(partial): ComparatorSet
desugarCaret(partial): ComparatorSet
desugarXRange(partial): ComparatorSet
desugarHyphen(lower, upper): ComparatorSet
```

Each function takes a `Partial` (a version that may have missing
components) and returns a `ComparatorSet` of primitive comparators.

**Partial type:**

```text
Partial
  major: number | null
  minor: number | null
  patch: number | null
  prerelease: ReadonlyArray<string | number>
  build: ReadonlyArray<string>
```

A `null` component indicates a wildcard position (x, X, *, or missing).

#### src/utils/normalize.ts

Post-parse normalization of ranges. Applies simplification rules that do
not change semantics but produce cleaner output.

**Key functions:**

```text
normalizeRange(range): Range
normalizeComparatorSet(set): ComparatorSet
removeDuplicateComparators(set): ComparatorSet
sortComparators(set): ComparatorSet
```

**Normalization rules:**

- Remove duplicate comparators within a set
- Sort comparators by operator precedence (>= before <)
- Collapse redundant bounds (e.g., `>=1.0.0 >=1.2.0` becomes `>=1.2.0`)
- Remove impossible sets (e.g., `>=2.0.0 <1.0.0` becomes empty)

### Data Flow Through the Parser

```text
Input string
     |
     v
SemVerParserLive.parseRange(input)
     |
     v
grammar.parseRangeSet(state)
     |
     +-- For each range set separated by ||:
     |     |
     |     +-- grammar.parseRange(state)
     |           |
     |           +-- Detect tilde/caret/hyphen/x-range/primitive
     |           |
     |           +-- Call desugar function if sugar detected
     |           |     |
     |           |     +-- desugar.desugarTilde(partial)
     |           |     +-- desugar.desugarCaret(partial)
     |           |     +-- desugar.desugarXRange(partial)
     |           |     +-- desugar.desugarHyphen(low, high)
     |           |
     |           +-- Collect ComparatorSet (array of Comparators)
     |
     v
normalize.normalizeRange(range)
     |
     v
Range (immutable, desugared, normalized)
```

---

## Error Handling

All parser errors carry the original input string and, where possible, the
exact character position where parsing failed. Errors are constructed using
Effect's TaggedError and flow through the typed error channel.

### Error Types

#### InvalidVersionError

Produced by `parseVersion` when the input does not match the
`<valid-semver>` grammar.

```text
InvalidVersionError
  _tag: "InvalidVersionError"
  input: string                  -- the original input
  position: number | undefined   -- character offset of failure
  message: string                -- human-readable description
```

**Common causes:**

- Missing components (`"1.0"` -- no patch)
- Leading zeros (`"01.0.0"`)
- Invalid characters (`"1.0.0-beta!"`)
- Leading `v` prefix (`"v1.0.0"`)
- Empty input (`""`)

#### InvalidRangeError

Produced by `parseRange` when the range expression cannot be parsed.

```text
InvalidRangeError
  _tag: "InvalidRangeError"
  input: string
  position: number | undefined
  message: string
```

**Common causes:**

- Malformed operator (`">>1.0.0"`)
- Invalid union syntax (`"1.0.0 ||| 2.0.0"`)
- Unterminated hyphen range (`"1.0.0 -"`)
- Invalid partial version in range context

#### InvalidComparatorError

Produced by `parseComparator` when a single comparator is malformed.

```text
InvalidComparatorError
  _tag: "InvalidComparatorError"
  input: string
  position: number | undefined
  message: string
```

### Error Position Strategy

The parser tracks cursor position throughout the parse. When an error
occurs, the position reflects the character where the parser could not
continue. For compound errors (e.g., a valid operator followed by an
invalid version), the position points to the start of the failing
sub-production, not the operator.

**Example error positions:**

```text
Input:    ">=1.02.3"
Position:      ^  (position 5, the leading zero in minor)

Input:    "1.0.0 || >=abc"
Position:            ^  (position 12, expected digit)

Input:    "1.0.0 - "
Position:          ^  (position 8, unexpected end of input)
```

### Error Messages

Error messages follow a consistent format:

```text
"Expected <what> at position <N>, found <actual>"
"Unexpected end of input at position <N>, expected <what>"
"Leading zeros are not allowed in <component> at position <N>"
"Invalid <component>: <detail>"
```

Messages reference the grammar production name when helpful (e.g.,
"numeric identifier", "pre-release identifier") to help users understand
what syntax is expected.

---

## Tricky Valid Strings

These test cases exercise corner cases in the grammar that are easy to get
wrong. Each one is valid according to the SemVer 2.0.0 BNF and must be
accepted by the parser.

| Input | Why It Is Valid |
| :--- | :--- |
| `1.0.0--` | A single hyphen is a valid alphanumeric identifier (hyphen is a `<non-digit>`) |
| `1.0.0---` | Multiple hyphens are a valid alphanumeric identifier |
| `1.0.0-0alpha` | Starts with `0` but contains a letter, so it is alphanumeric -- NOT a leading zero violation |
| `1.0.0-0-0` | Starts with `0` but contains a hyphen, so it is alphanumeric -- NOT a leading zero violation |
| `1.0.0-alpha.-1` | `-1` as a pre-release identifier: contains a hyphen, so it is alphanumeric (not numeric `-1`) |
| `1.0.0+001` | Build metadata uses `<digits>` not `<numeric-identifier>`, so leading zeros are permitted |

**Strings that MUST be rejected:**

| Input | Why It Is Invalid |
| :--- | :--- |
| `v1.2.3` | `v` prefix not part of SemVer spec (FAQ explicitly states this) |
| `V1.2.3` | Same as above, case-insensitive rejection |
| `1.0.0-01` | Numeric pre-release identifier with leading zero (`01` is all digits, starts with `0`, length > 1) |
| `1.0.0-00` | Same rule: `00` is all digits, starts with `0`, length > 1 |
| `1.0.0+build+extra` | `+` is not valid in `[0-9A-Za-z-]`, so the second `+` is an invalid character |
| `~>1.2.3` | `~>` (Ruby-style tilde) is not part of SemVer or node-semver's BNF; produces `InvalidRangeError` |

These cases should be included in the parser test suite to prevent
regressions.

---

## Related Documentation

**Architecture:**

- [architecture.md](architecture.md) -- Overall system architecture,
  component overview, and design decisions

**Dependencies (required reading for implementation):**

- data-model.md -- SemVer, Range, Comparator, ComparatorSet definitions
- error-model.md -- Error type hierarchy and field specifications

**External References:**

- [SemVer 2.0.0 Specification](https://semver.org) -- Authoritative grammar
  and precedence rules
- [node-semver ranges](https://github.com/npm/node-semver#ranges) --
  Reference for range syntax (tilde, caret, x-range, hyphen)

**Design Spec:**

- [semver-effect Design Spec](../../../docs/specs/semver-effect-design.md) --
  Approved design specification with full API surface

---

**Document Status:** Draft -- covers the full parser design including BNF
grammar, desugaring rules, service API, internal module structure, and error
handling. Depends on data-model.md and error-model.md which are not yet
created.

**Next Steps:** Create data-model.md and error-model.md design documents.
Begin implementation of grammar.ts starting with the version grammar
productions, then extend to range grammar.
