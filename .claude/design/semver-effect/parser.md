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
5. [Parsing Implementation](#parsing-implementation)
6. [Desugaring Rules](#desugaring-rules)
7. [Service API](#service-api)
8. [Internal Architecture](#internal-architecture)
9. [Error Handling](#error-handling)
10. [Tricky Valid Strings](#tricky-valid-strings)
11. [Related Documentation](#related-documentation)

---

## Overview

The parser is the primary entry point for all user input in semver-effect.
Every version string and range expression flows through the parser before
becoming an immutable data type. The parser implements the SemVer 2.0.0 BNF
grammar via a hand-written recursive descent strategy, walking the input
character by character with no regex and no backtracking.

**Key properties:**

- Strict SemVer 2.0.0 grammar -- rejects anything that does not conform
- Character-by-character walk producing precise error positions
- All syntactic sugar (tilde, caret, x-range, hyphen) desugared to
  primitive ComparatorSets during parsing
- Exposed both as an Effect service (SemVerParser) and as standalone
  convenience functions
- Every parse operation returns an Effect with a typed error channel

---

## Current State

The parser is fully implemented and tested. All grammar productions, desugaring
rules, and error handling are working.

### File Structure

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
    parseRange.ts               -- Convenience parseRange wrapper
  schemas/
    SemVer.ts                   -- SemVer schema type
    Comparator.ts               -- Comparator schema type
    Range.ts                    -- Range schema type + ComparatorSet alias
  errors/
    InvalidVersionError.ts      -- Version parse error
    InvalidRangeError.ts        -- Range parse error
    InvalidComparatorError.ts   -- Comparator parse error
```

---

## Rationale

### Why Recursive Descent

A recursive descent parser maps directly to the BNF grammar productions.
Each grammar rule becomes a function. Chosen over regex for:

1. **Precise error positions.** The parser knows exactly which character
   caused the failure.
2. **Maintainability.** Grammar functions mirror the BNF spec one to one.
3. **No backtracking.** The SemVer grammar is LL(1) for version strings.
   Range expressions require bounded lookahead (three characters for hyphen
   range detection) without backtracking.

### Why Desugar During Parsing

Syntactic sugar is eliminated during parsing rather than preserved in the
AST. Downstream code only handles primitive comparators. The tradeoff is
that the original syntax is not recoverable, but Range.toString() produces
a canonical primitive form.

### Why an Effect Service

The parser is stateless, but wrapping it as an Effect service provides
consistent API pattern, dependency injection for testing, and future
extensibility. Standalone convenience functions are also exported for
simpler use cases.

---

## Grammar Specification

### Version Grammar

```bnf
<valid-semver> ::= <version-core>
                 | <version-core> "-" <pre-release>
                 | <version-core> "+" <build>
                 | <version-core> "-" <pre-release> "+" <build>

<version-core> ::= <major> "." <minor> "." <patch>

<numeric-identifier> ::= "0"
                       | <positive-digit>
                       | <positive-digit> <digits>
```

**Numeric identifier rule:** No leading zeros. `"0"` is valid, `"01"` is not.

**Build metadata `+` delimiter:** Only one `+` in a valid semver string.
Everything after the first `+` is build metadata. `1.0.0+build+extra` is
rejected.

### Range Grammar

```bnf
<range-set> ::= <range>
              | <range> <logical-or> <range-set>

<logical-or> ::= optional-spaces "||" optional-spaces

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
```

**`~>` is NOT supported.** The Ruby-style pessimistic constraint is explicitly
rejected. `~>1.2.3` produces an `InvalidRangeError` at the `>` character.

```bnf
<partial> ::= <xr>
            | <xr> "." <xr>
            | <xr> "." <xr> "." <xr> <qualifier>

<xr> ::= "x" | "X" | "*" | <numeric-identifier>
```

### Whitespace Rules

- Spaces between comparators in a set are significant (implicit AND)
- Spaces around `||` are optional
- Spaces around `-` in hyphen ranges are required
- Leading and trailing whitespace on the full input is trimmed

---

## Parsing Implementation

### Parser State

```typescript
interface ParserState {
  readonly input: string;   // original input (immutable)
  pos: number;              // current cursor position (mutable)
  readonly len: number;     // input length (cached)
}
```

### Character-Level Helpers

```text
peek(s): string | undefined       -- look at current char
advance(s): string | undefined    -- consume and return current char
isDigit(ch): boolean
isLetter(ch): boolean
isIdentChar(ch): boolean          -- digit, letter, or hyphen
atEnd(s): boolean
peekDigit(s): boolean
peekIdentChar(s): boolean
```

### Identifier Type Detection

The parser uses a two-phase approach for prerelease identifiers:

1. **Consume** all characters matching `[0-9A-Za-z-]`
2. **Classify** after consumption: if any non-digit found, it is alphanumeric
   (no leading zero restriction). If all digits, it is numeric (validate no
   leading zeros).

This means `0alpha` is alphanumeric (not a leading zero violation) and
`-1` as a prerelease identifier is alphanumeric (contains hyphen).

### Strict V-Prefix Rejection

`v1.2.3` and `V1.2.3` are rejected immediately. No stripping, no coercion.

### Integer Overflow Validation

`parseNumericIdentifier` converts digits via `Number()` and checks with
`Number.isSafeInteger()`. Values exceeding `Number.MAX_SAFE_INTEGER` produce
an error.

### Range Parsing: Hyphen Detection

The parser uses bounded lookahead (3 characters: space, dash, space) to
detect hyphen ranges. If the pattern doesn't match, it falls back to
space-separated simples.

### disableValidation

All SemVer/Comparator/Range instances constructed by the parser use
`{ disableValidation: true }` since values are already validated by the
grammar.

---

## Desugaring Rules

All syntactic sugar is converted to primitive comparator sets during
parsing. Desugaring is implemented in `src/utils/desugar.ts`.

### Tilde Ranges

```text
~1.2.3    -->  >=1.2.3 <1.3.0-0
~1.2      -->  >=1.2.0 <1.3.0-0
~1        -->  >=1.0.0 <2.0.0-0
~0.2.3    -->  >=0.2.3 <0.3.0-0
```

### Caret Ranges

```text
^1.2.3    -->  >=1.2.3 <2.0.0-0
^0.2.3    -->  >=0.2.3 <0.3.0-0
^0.0.3    -->  >=0.0.3 <0.0.4-0
^1.2.x    -->  >=1.2.0 <2.0.0-0
^0.0.x    -->  >=0.0.0 <0.1.0-0
^0.0      -->  >=0.0.0 <0.1.0-0
^0.x      -->  >=0.0.0 <1.0.0-0
^0.0.0    -->  >=0.0.0 <0.0.1-0
```

### X-Ranges

```text
*         -->  >=0.0.0
1.x       -->  >=1.0.0 <2.0.0-0
1.2.x     -->  >=1.2.0 <1.3.0-0
""        -->  >=0.0.0             (empty string = match all)
```

With operators:

- `>1.x` -> `>=2.0.0`
- `>=1.x` -> `>=1.0.0`
- `<1.x` -> `<1.0.0`
- `<=1.x` -> `<2.0.0-0`

### Hyphen Ranges

```text
1.2.3 - 2.3.4    -->  >=1.2.3 <=2.3.4
1.2 - 2.3.4      -->  >=1.2.0 <=2.3.4
1.2.3 - 2.3      -->  >=1.2.3 <2.4.0-0
1.2.3 - 2        -->  >=1.2.3 <3.0.0-0
```

### Implicit Equality

A bare version with no operator: `1.2.3` -> `=1.2.3`.

---

## Service API

### SemVerParser Service

```typescript
// src/services/SemVerParser.ts
export interface SemVerParser {
  readonly parseVersion: (input: string) => Effect.Effect<SemVer, InvalidVersionError>;
  readonly parseRange: (input: string) => Effect.Effect<Range, InvalidRangeError>;
  readonly parseComparator: (input: string) => Effect.Effect<Comparator, InvalidComparatorError>;
}
export const SemVerParser = Context.GenericTag<SemVerParser>("SemVerParser");
```

### Layer Implementation

```typescript
// src/layers/SemVerParserLive.ts
export const SemVerParserLive: Layer.Layer<SemVerParser> = Layer.succeed(
  SemVerParser,
  SemVerParser.of({
    parseVersion: parseValidSemVer,
    parseRange: (input) => Effect.map(parseRangeSet(input), normalizeRange),
    parseComparator: parseSingleComparator,
  }),
);
```

The layer uses `Layer.succeed` (not `Layer.effect`) because the parser is
stateless. Range parsing applies normalization (sort comparators, remove
duplicates) after the grammar parse.

### Convenience Functions

Standalone functions exported directly from `src/index.ts`:

```text
parseVersion(input: string): Effect<SemVer, InvalidVersionError>
parseRange(input: string): Effect<Range, InvalidRangeError>
parseComparator(input: string): Effect<Comparator, InvalidComparatorError>
```

These do not require Layer composition. `parseVersion` and `parseComparator`
come from `grammar.ts`; `parseRange` comes from `parseRange.ts` (applies
normalization).

---

## Internal Architecture

### Module Responsibilities

**`src/utils/grammar.ts`**: Core recursive descent parser. Contains:

- `parseValidSemVer`: Full version string parser
- `parseRangeSet`: Full range expression parser
- `parseSingleComparator`: Single comparator parser
- Internal helpers for numeric identifiers, prerelease, build, partials,
  operators, and range structures
- Separate sets of helpers for version errors vs range errors

**`src/utils/desugar.ts`**: Converts parsed sugar forms into primitive
comparator sets:

- `desugarTilde`, `desugarCaret`, `desugarXRange`, `desugarHyphen`
- Exports the `Partial` interface type

**`src/utils/normalize.ts`**: Post-parse normalization:

- `normalizeRange`: Applies to each ComparatorSet
- `normalizeComparatorSet`: Removes duplicates and sorts by operator weight
- Operator weight order: `>=`, `>`, `=`, `<`, `<=`

### Data Flow

```text
Input string
     |
     v
grammar.parseRangeSet(state) or grammar.parseValidSemVer(state)
     |
     +-- For ranges: detect tilde/caret/hyphen/x-range/primitive
     |     |
     |     +-- desugar.desugarTilde/Caret/XRange/Hyphen(partial)
     |
     +-- For versions: parse major.minor.patch[-prerelease][+build]
     |
     v
normalize.normalizeRange(range)   [ranges only]
     |
     v
SemVer / Range / Comparator (immutable, desugared, normalized)
```

---

## Error Handling

### Error Types

- **InvalidVersionError**: `{ input, position? }` -- from parseVersion
- **InvalidRangeError**: `{ input, position? }` -- from parseRange
- **InvalidComparatorError**: `{ input, position? }` -- from parseComparator

### Error Position Strategy

The parser tracks cursor position throughout. When an error occurs, position
reflects the character where the parser could not continue.

**Examples:**

```text
Input:    ">=1.02.3"
Position:      ^  (position 5, leading zero in minor)

Input:    "v1.0.0"
Position: ^  (position 0, v prefix rejected)

Input:    "1.0"
Position:    ^  (position 3, expected dot for patch)
```

### Version vs Range Error Separation

The grammar module maintains separate helper functions for version parsing
(producing `InvalidVersionError`) and range parsing (producing
`InvalidRangeError`). This ensures callers get the appropriate error type
in their typed error channel.

---

## Tricky Valid Strings

| Input | Why It Is Valid |
| :--- | :--- |
| `1.0.0--` | Hyphen is a valid `<non-digit>` in alphanumeric identifier |
| `1.0.0---` | Multiple hyphens valid |
| `1.0.0-0alpha` | Starts with `0` but contains letter -> alphanumeric |
| `1.0.0-0-0` | Starts with `0` but contains hyphen -> alphanumeric |
| `1.0.0-alpha.-1` | `-1` contains hyphen -> alphanumeric (not numeric -1) |
| `1.0.0+001` | Build uses `<digits>` not `<numeric-identifier>` |

**Must be rejected:**

| Input | Why It Is Invalid |
| :--- | :--- |
| `v1.2.3` | v prefix not part of SemVer spec |
| `1.0.0-01` | Numeric prerelease with leading zero |
| `1.0.0+build+extra` | Second `+` is invalid |
| `~>1.2.3` | Ruby-style tilde not supported |

---

## Related Documentation

- [architecture.md](architecture.md) -- System architecture and component overview
- [data-model.md](data-model.md) -- SemVer, Range, Comparator definitions
- [error-model.md](error-model.md) -- Error types and field specifications
- [SemVer 2.0.0 Specification](https://semver.org) -- Authoritative grammar
- [node-semver ranges](https://github.com/npm/node-semver#ranges) --
  Reference for range syntax conventions

---

**Document Status:** Current -- covers the complete parser implementation
including BNF grammar, desugaring rules, service API, convenience functions,
internal architecture, and error handling. All components are implemented
and tested.
