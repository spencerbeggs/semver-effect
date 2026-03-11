# node-semver Test Suite Analysis

Research into the npm/node-semver repository test structure, fixture data, and
coverage to inform the semver-effect implementation.

**Repository:** <https://github.com/npm/node-semver>
**Date:** 2026-03-10
**Branch analyzed:** main

---

## Table of Contents

1. [Test File Inventory](#test-file-inventory)
2. [Test Fixture Data Catalog](#test-fixture-data-catalog)
3. [Strict vs Loose Divergences](#strict-vs-loose-divergences)
4. [Coverage Gaps](#coverage-gaps)
5. [Test Data Extraction](#test-data-extraction)
6. [Recommended Test Structure](#recommended-test-structure)

---

## Test File Inventory

### Fixture Data Files (`test/fixtures/`)

| File | What It Contains |
| :--- | :--- |
| `valid-versions.js` | 23 valid version strings with expected parsed components (major, minor, patch, prerelease[], build[]) |
| `invalid-versions.js` | 10 invalid inputs (too long, too big, non-strings, junk text); references `MAX_LENGTH` and `MAX_SAFE_INTEGER` constants |
| `comparisons.js` | 32 version pairs where v1 > v2; covers numeric ordering, prerelease ordering, build metadata, case sensitivity |
| `equality.js` | 37 version pairs that should be equal; heavily tests loose-mode `v` prefix and `=` prefix with whitespace variations, plus build metadata equality |
| `increments.js` | ~120 increment test cases: `[version, incType, expected, options, identifier, identifierBase]`; covers major/minor/patch/prerelease/premajor/preminor/prepatch/release bumps |
| `range-include.js` | ~110 range-satisfaction pairs where version IS in range; covers hyphen, caret, tilde, x-range, primitives, OR unions, `includePrerelease` option |
| `range-exclude.js` | ~90 range-satisfaction pairs where version is NOT in range; similar coverage plus prerelease exclusion semantics |
| `range-parse.js` | ~100 range parsing cases: `[input, canonicalOutput, options]`; null output means invalid range. Covers all syntactic sugar desugaring |
| `comparator-intersection.js` | 36 comparator intersection pairs with expected boolean result |
| `range-intersection.js` | 56 range intersection pairs with expected boolean result |
| `version-gt-range.js` | 57 cases where version is greater than range (for `gtr()`) |
| `version-lt-range.js` | 59 cases where version is less than range (for `ltr()`) |
| `version-not-gt-range.js` | 79 cases where version is NOT greater than range |
| `version-not-lt-range.js` | 78 cases where version is NOT less than range |

### Class Tests (`test/classes/`)

| File | What It Tests |
| :--- | :--- |
| `semver.js` | SemVer construction from valid/invalid inputs, comparisons, equality, toString, incrementing (via fixture data), compareMain vs comparePre, compareBuild, really big prerelease values, invalid version error messages |
| `range.js` | Range construction, parsing (via `range-parse` fixture), test() for include/exclude (via fixtures), strict vs loose, toString, format caching, intersection (via fixture), conversion from Comparator, Range-as-arg identity |
| `comparator.js` | Comparator construction, toString, intersection (via fixture), ANY matching, invalid comparator errors, `=` prefix handling |
| `index.js` | Smoke test verifying exports |

### Function Tests (`test/functions/`)

| File | What It Tests |
| :--- | :--- |
| `parse.js` | Returns null for invalid versions (fixture), throws if asked to, parses valid into SemVer objects |
| `valid.js` | Returns null for invalid, validates strings and SemVer objects, long build identifiers, MAX_SAFE_INTEGER boundaries |
| `clean.js` | Strips whitespace/`v`/`=` prefixes; returns null for range-like strings |
| `compare.js` | Comparison and equality via fixtures |
| `compare-build.js` | Build metadata comparison ordering |
| `compare-loose.js` | Loose-mode comparison |
| `cmp.js` | All comparison operators: `>`, `<`, `>=`, `<=`, `=`, `!=`, `===`, `!==` |
| `coerce.js` | **LOOSE MODE** -- coerces partial/messy strings into valid semver; many edge cases with rtl, includePrerelease |
| `diff.js` | 37 inline diff test cases: major, minor, patch, premajor, preminor, prepatch, prerelease, null (equal) |
| `eq.js` | Equality via fixture |
| `gt.js` | Greater-than via fixture |
| `gte.js` | Greater-than-or-equal via fixture |
| `lt.js` | Less-than via fixture |
| `lte.js` | Less-than-or-equal via fixture |
| `neq.js` | Not-equal via fixture |
| `inc.js` | Incrementing via fixtures; verifies immutability (input not modified) |
| `major.js` / `minor.js` / `patch.js` | Component extraction |
| `prerelease.js` | Prerelease array extraction |
| `rcompare.js` | Reverse comparison |
| `rsort.js` / `sort.js` | Sorting arrays of versions |
| `satisfies.js` | Range satisfaction via include/exclude fixtures; invalid ranges never satisfy |

### Range Tests (`test/ranges/`)

| File | What It Tests |
| :--- | :--- |
| `gtr.js` | Greater-than-range via fixtures |
| `ltr.js` | Less-than-range via fixtures |
| `intersects.js` | Comparator and range intersection via fixtures |
| `max-satisfying.js` | Finding max version satisfying a range from a list |
| `min-satisfying.js` | Finding min version satisfying a range from a list |
| `min-version.js` | Finding the minimum possible version for a range (54 inline cases) |
| `outside.js` | General outside() with `>` and `<` hilo, plus error for invalid hilo |
| `simplify.js` | Range simplification against a version list |
| `subset.js` | Range subset testing (90+ inline cases) |
| `to-comparators.js` | Converting range to comparator arrays |
| `valid.js` | Range validation |

### Other Tests

| File | What It Tests |
| :--- | :--- |
| `test/integration/whitespace.js` | ReDoS protection: ranges/versions with huge whitespace (500k spaces); verifies they parse without hanging |
| `test/internal/re.js` | Regex safety: verifies safe regexes don't contain greedy `\s+`/`\s*` |
| `test/internal/constants.js` | Constants are defined |
| `test/internal/identifiers.js` | Identifier comparison helpers |
| `test/internal/lrucache.js` | Internal LRU cache |
| `test/internal/parse-options.js` | Options normalization |
| `test/internal/debug.js` | Debug logging |
| `test/bin/semver.js` | CLI binary tests |
| `test/map.js` | Export map verification |
| `test/preload.js` | Module preloading |

---

## Test Fixture Data Catalog

### Valid Versions (`test/fixtures/valid-versions.js`)

Format: `[versionString, major, minor, patch, prerelease[], build[]]`

```text
Basic:
  '1.0.0'     -> 1, 0, 0, [], []
  '2.1.0'     -> 2, 1, 0, [], []
  '3.2.1'     -> 3, 2, 1, [], []
  'v1.2.3'    -> 1, 2, 3, [], []          ** v-prefix (we SKIP this -- strict mode) **

Prerelease:
  '1.2.3-0'           -> [0]
  '1.2.3-123'         -> [123]
  '1.2.3-1.2.3'       -> [1, 2, 3]
  '1.2.3-1a'          -> ['1a']
  '1.2.3-a1'          -> ['a1']
  '1.2.3-alpha'       -> ['alpha']
  '1.2.3-alpha.1'     -> ['alpha', 1]
  '1.2.3-alpha-1'     -> ['alpha-1']
  '1.2.3-alpha-.-beta' -> ['alpha-', '-beta']

Build:
  '1.2.3+456'              -> [], ['456']
  '1.2.3+build'            -> [], ['build']
  '1.2.3+new-build'        -> [], ['new-build']
  '1.2.3+build.1'          -> [], ['build', '1']
  '1.2.3+build.1a'         -> [], ['build', '1a']
  '1.2.3+build.a1'         -> [], ['build', 'a1']
  '1.2.3+build.alpha'      -> [], ['build', 'alpha']
  '1.2.3+build.alpha.beta' -> [], ['build', 'alpha', 'beta']

Combined:
  '1.2.3-alpha+build' -> ['alpha'], ['build']
```

### Invalid Versions (`test/fixtures/invalid-versions.js`)

```text
Too long:    '1'.repeat(255) + '.0.0'   (MAX_LENGTH = 256)
Too big:     MAX_SAFE_INTEGER + '0' + '.0.0'  (each component)
Junk text:   'hello, world', 'xyz'
Non-string:  /a regexp/, /1.2.3/, { toString: () => '1.2.3' }
Loose junk:  'hello, world' (still invalid even in loose mode)
```

**NOTE:** node-semver's invalid version list is surprisingly thin. It does NOT
include: leading zeros (`01.0.0`), trailing characters (`1.0.0.4`), empty
prerelease (`1.0.0-`), negative numbers, etc. These are caught by other inline
tests or by the regex itself.

### Comparisons (`test/fixtures/comparisons.js`)

Format: `[v1, v2, options]` -- v1 > v2

**Strict-mode pairs (no options or `{}` options):**

```text
'0.0.0'      > '0.0.0-foo'           (release > prerelease)
'0.0.1'      > '0.0.0'               (patch ordering)
'1.0.0'      > '0.9.9'               (major ordering)
'0.10.0'     > '0.9.0'               (minor ordering)
'0.99.0'     > '0.10.0'              (numeric, not lexicographic)
'2.0.0'      > '1.2.3'
'1.2.3'      > '1.2.3-asdf'          (release > prerelease)
'1.2.3'      > '1.2.3-4'
'1.2.3'      > '1.2.3-4-foo'
'1.2.3-5-foo' > '1.2.3-5'            (longer prerelease > shorter)
'1.2.3-5'    > '1.2.3-4'             (numeric prerelease ordering)
'1.2.3-5-foo' > '1.2.3-5-Foo'        (case-sensitive: lowercase > uppercase)
'3.0.0'      > '2.7.2+asdf'          (build metadata ignored)
'1.2.3-a.10' > '1.2.3-a.5'           (numeric prerelease sub-field)
'1.2.3-a.b'  > '1.2.3-a.5'           (alphanumeric > numeric)
'1.2.3-a.b'  > '1.2.3-a'             (longer > shorter when prefix matches)
'1.2.3-a.b.c.10.d.5' > '1.2.3-a.b.c.5.d.100'  (leftmost numeric field wins)
'1.2.3-r2'   > '1.2.3-r100'          (alphanumeric: lexicographic, not numeric)
'1.2.3-r100' > '1.2.3-R2'            (lowercase > uppercase)
```

**Loose-mode pairs (options = `true` or `{ loose: true }`):**
These all use `v` prefix, e.g. `'v0.0.0' > '0.0.0-foo'`. We SKIP these.

### Equality (`test/fixtures/equality.js`)

Format: `[v1, v2, loose]`

**IMPORTANT: Almost ALL equality tests require loose mode** (`true` as third
arg). They test `v` prefix, `=` prefix, and whitespace tolerance. Only these
entries work in strict mode:

```text
'1.2.3-beta+build' == '1.2.3-beta+otherbuild'   (build metadata ignored)
'1.2.3+build'      == '1.2.3+otherbuild'         (build metadata ignored)
'  v1.2.3+build'   == '1.2.3+otherbuild'         ** has whitespace, loose implied by v prefix **
```

In strict mode, only the build-metadata equality cases are usable. The rest
test loose parsing (`v`, `=`, whitespace) which we do not support.

### Range Parse (`test/fixtures/range-parse.js`)

Format: `[input, canonicalOutput, options]` -- null output means invalid

**Strict-mode entries (no options, or `null` options, or `{ includePrerelease: true }`):**

Hyphen ranges:

```text
'1.0.0 - 2.0.0'              -> '>=1.0.0 <=2.0.0'
'1 - 2'                      -> '>=1.0.0 <3.0.0-0'
'1.0 - 2.0'                  -> '>=1.0.0 <2.1.0-0'
'1.2 - 3.4.5'                -> '>=1.2.0 <=3.4.5'
'1.2.3 - 3.4'                -> '>=1.2.3 <3.5.0-0'
'1.2 - 3.4'                  -> '>=1.2.0 <3.5.0-0'

With includePrerelease:
'1.0.0 - 2.0.0'              -> '>=1.0.0-0 <2.0.1-0'
'1 - 2'                      -> '>=1.0.0-0 <3.0.0-0'
'1.0 - 2.0'                  -> '>=1.0.0-0 <2.1.0-0'
```

Primitives:

```text
'1.0.0'                      -> '1.0.0'
'>=1.0.0'                    -> '>=1.0.0'
'>1.0.0'                     -> '>1.0.0'
'<=2.0.0'                    -> '<=2.0.0'
'<2.0.0'                     -> '<2.0.0'
'>=*'                        -> '*'
''                            -> '*'
'*'                           -> '*'
```

Whitespace normalization:

```text
'>= 1.0.0'                   -> '>=1.0.0'
'>=  1.0.0'                  -> '>=1.0.0'
'>=   1.0.0'                 -> '>=1.0.0'
'> 1.0.0'                    -> '>1.0.0'
'>  1.0.0'                   -> '>1.0.0'
'<=   2.0.0'                 -> '<=2.0.0'
'<= 2.0.0'                   -> '<=2.0.0'
'<=  2.0.0'                  -> '<=2.0.0'
'<    2.0.0'                 -> '<2.0.0'
'<\t2.0.0'                   -> '<2.0.0'
```

Partial (x-range) desugaring:

```text
'1'                           -> '>=1.0.0 <2.0.0-0'
'2.x.x'                      -> '>=2.0.0 <3.0.0-0'
'1.2.x'                      -> '>=1.2.0 <1.3.0-0'
'1.2.x || 2.x'               -> '>=1.2.0 <1.3.0-0||>=2.0.0 <3.0.0-0'
'x'                           -> '*'
'2.*.*'                       -> '>=2.0.0 <3.0.0-0'
'1.2.*'                       -> '>=1.2.0 <1.3.0-0'
'1.2.* || 2.*'                -> '>=1.2.0 <1.3.0-0||>=2.0.0 <3.0.0-0'
'2'                           -> '>=2.0.0 <3.0.0-0'
'2.3'                         -> '>=2.3.0 <2.4.0-0'
```

OR unions:

```text
'0.1.20 || 1.2.4'            -> '0.1.20||1.2.4'
'>=0.2.3 || <0.0.1'          -> '>=0.2.3||<0.0.1'
'||'                          -> '*'
```

Tilde ranges:

```text
'~2.4'                        -> '>=2.4.0 <2.5.0-0'
'~>3.2.1'                     -> '>=3.2.1 <3.3.0-0'
'~1'                          -> '>=1.0.0 <2.0.0-0'
'~>1'                         -> '>=1.0.0 <2.0.0-0'
'~> 1'                        -> '>=1.0.0 <2.0.0-0'
'~1.0'                        -> '>=1.0.0 <1.1.0-0'
'~ 1.0'                       -> '>=1.0.0 <1.1.0-0'
```

Caret ranges:

```text
'^0'                          -> '<1.0.0-0'
'^ 1'                         -> '>=1.0.0 <2.0.0-0'
'^0.1'                        -> '>=0.1.0 <0.2.0-0'
'^1.0'                        -> '>=1.0.0 <2.0.0-0'
'^1.2'                        -> '>=1.2.0 <2.0.0-0'
'^0.0.1'                      -> '>=0.0.1 <0.0.2-0'
'^0.0.1-beta'                 -> '>=0.0.1-beta <0.0.2-0'
'^0.1.2'                      -> '>=0.1.2 <0.2.0-0'
'^1.2.3'                      -> '>=1.2.3 <2.0.0-0'
'^1.2.3-beta.4'               -> '>=1.2.3-beta.4 <2.0.0-0'
```

Shorthand comparators:

```text
'<1'                          -> '<1.0.0-0'
'< 1'                         -> '<1.0.0-0'
'>=1'                         -> '>=1.0.0'
'>= 1'                        -> '>=1.0.0'
'<1.2'                        -> '<1.2.0-0'
'< 1.2'                       -> '<1.2.0-0'
'>1'                          -> '>=2.0.0'
'>1.2'                        -> '>=1.3.0'
```

Special cases:

```text
'>X'                          -> '<0.0.0-0'     (greater than everything = nothing)
'<X'                          -> '<0.0.0-0'     (less than nothing = nothing)
'<x <* || >* 2.x'            -> '<0.0.0-0'
'>x 2.x || * || <x'           -> '*'
'^ 1.2 ^ 1'                  -> '>=1.2.0 <2.0.0-0 >=1.0.0'
```

MAX_SAFE_INTEGER boundary:

```text
'^MAX_SAFE_INTEGER.0.0'       -> null (invalid)
'=MAX_SAFE_INTEGER.0.0'       -> 'MAX_SAFE_INTEGER.0.0'
'^(MAX_SAFE_INTEGER-1).0.0'   -> '>=(MSI-1).0.0 <MSI.0.0-0'
```

X-ranges with build metadata (all use `null` options = strict):

```text
'1.x.x+build >2.x+build'         -> '>=1.0.0 <2.0.0-0 >=3.0.0'
'>=1.x+build <2.x.x+build'       -> '>=1.0.0 <2.0.0-0'
'1.x.x+build || 2.x.x+build'     -> '>=1.0.0 <2.0.0-0||>=2.0.0 <3.0.0-0'
(... 20+ more build metadata cases)
```

X-ranges with prerelease and build (strict):

```text
'1.x.x-alpha+build'               -> '>=1.0.0 <2.0.0-0'
'>1.x.x-alpha+build'              -> '>=2.0.0'
'>=1.x.x-alpha+build <2.x.x+build' -> '>=1.0.0 <2.0.0-0'
```

**Invalid ranges (null output, strict mode):**

```text
'>01.02.03'                   -> null  (leading zeros)
'~1.2.3beta'                  -> null  (missing hyphen before prerelease)
'>=09090'                     -> null  (leading zero)
'^MAX_SAFE_INTEGER.0.0'       -> null  (overflow)
```

**Loose-mode entries (we SKIP):**

```text
'>01.02.03'  -> '>1.2.3'  (loose: true)
'~1.2.3beta' -> '>=1.2.3-beta <1.3.0-0' (loose: true)
'>=09090'    -> '>=9090.0.0' (loose: true)
```

### Range Satisfaction -- Include (`test/fixtures/range-include.js`)

Format: `[range, version, options]`

**Strict-mode entries (no options, `{}`, or options with only non-loose flags):**

Hyphen ranges:

```text
'1.0.0 - 2.0.0'                satisfies '1.2.3'
'1.2.3-pre+asdf - 2.4.3-pre+asdf'  satisfies '1.2.3'
'1.2.3-pre+asdf - 2.4.3-pre+asdf'  satisfies '1.2.3-pre.2'
'1.2.3-pre+asdf - 2.4.3-pre+asdf'  satisfies '2.4.3-alpha'
'1.2.3+asdf - 2.4.3+asdf'     satisfies '1.2.3'
```

Exact versions:

```text
'1.0.0'                       satisfies '1.0.0'
```

Wildcards:

```text
'>=*'                          satisfies '0.2.4'
''                             satisfies '1.0.0'
'*'                            satisfies '1.2.3'
```

Primitive comparators:

```text
'>=1.0.0'                     satisfies '1.0.0', '1.0.1', '1.1.0'
'>1.0.0'                      satisfies '1.0.1', '1.1.0'
'<=2.0.0'                     satisfies '2.0.0', '1.9999.9999', '0.2.9'
'<2.0.0'                      satisfies '1.9999.9999', '0.2.9'
(with extra whitespace variants)
```

OR unions:

```text
'0.1.20 || 1.2.4'             satisfies '1.2.4'
'>=0.2.3 || <0.0.1'           satisfies '0.0.0', '0.2.3', '0.2.4'
'||'                           satisfies '1.3.4'
```

X-ranges:

```text
'2.x.x'                       satisfies '2.1.3'
'1.2.x'                       satisfies '1.2.3'
'x'                            satisfies '1.2.3'
'2.*.*'                        satisfies '2.1.3'
'1.2.*'                        satisfies '1.2.3'
'*'                            satisfies '1.2.3'
'2'                            satisfies '2.1.2'
'2.3'                          satisfies '2.3.1'
```

Tilde:

```text
'~0.0.1'                      satisfies '0.0.1', '0.0.2'
'~x'                           satisfies '0.0.9'
'~2'                           satisfies '2.0.9'
'~2.4'                         satisfies '2.4.0', '2.4.5'
'~>3.2.1'                     satisfies '3.2.2'
'~1'                           satisfies '1.2.3'
'~>1'                          satisfies '1.2.3'
'~> 1'                         satisfies '1.2.3'
'~1.0'                         satisfies '1.0.2'
'~ 1.0'                        satisfies '1.0.2'
'~ 1.0.3'                      satisfies '1.0.12'
```

Caret:

```text
'^1.2.3'                      satisfies '1.8.1'
'^0.1.2'                      satisfies '0.1.2'
'^0.1'                         satisfies '0.1.2'
'^0.0.1'                      satisfies '0.0.1'
'^1.2'                         satisfies '1.4.2'
'^1.2 ^1'                     satisfies '1.4.2'
'^1.2.3-alpha'                 satisfies '1.2.3-pre'
'^1.2.0-alpha'                 satisfies '1.2.0-pre'
'^0.0.1-alpha'                 satisfies '0.0.1-beta', '0.0.1'
'^0.1.1-alpha'                 satisfies '0.1.1-beta'
'^x'                           satisfies '1.2.3'
```

Hyphen with partial:

```text
'x - 1.0.0'                   satisfies '0.9.7'
'x - 1.x'                     satisfies '0.9.7'
'1.0.0 - x'                   satisfies '1.9.7'
'1.x - x'                     satisfies '1.9.7'
'<=7.x'                        satisfies '7.9.9'
```

Compound:

```text
'~1.2.1 >=1.2.3'              satisfies '1.2.3'
'~1.2.1 =1.2.3'               satisfies '1.2.3'
'~1.2.1 1.2.3'                satisfies '1.2.3'
'>=1.2.1 1.2.3'               satisfies '1.2.3'
'>=1.2.3 >=1.2.1'             satisfies '1.2.3'
'>=1.2'                        satisfies '1.2.8'
```

Build metadata in range:

```text
'^1.2.3+build'                satisfies '1.2.3', '1.3.0'
```

includePrerelease option:

```text
'2.x'      satisfies '2.0.0-pre.0'     (includePrerelease: true)
'2.x'      satisfies '2.1.0-pre.0'     (includePrerelease: true)
'1.1.x'    satisfies '1.1.0-a'         (includePrerelease: true)
'*'        satisfies '1.0.0-rc1'        (includePrerelease: true)
'^1.0.0-0' satisfies '1.0.1-rc1'       (includePrerelease: true)
'^1.0.0'   satisfies '1.0.1-rc1'       (includePrerelease: true)
'1 - 2'    satisfies '2.0.0-pre'       (includePrerelease: true)
'=0.7.x'   satisfies '0.7.0-asdf'      (includePrerelease: true)
'>=1.0.0 <=1.1.0' satisfies '1.1.0-pre' (includePrerelease: true)
```

**Loose-mode entries (SKIP):**

```text
'1.2.3pre+asdf - 2.4.3-pre+asdf'  (loose: true -- missing hyphen)
'*'        satisfies 'v1.2.3'      (loose: 123 -- truthy value = loose)
'>=0.1.97' satisfies 'v0.1.97'     (loose: true -- v-prefix)
'~ 1.0.3alpha'                     (loose: true -- missing hyphen before prerelease)
'~v0.5.4-pre'                      (the ~v syntax -- accepted in strict mode by node-semver)
```

**NOTE on `~v` and `~>` syntax:** node-semver accepts `~v0.5.4-pre` and
`~>3.2.1` in strict mode. The `~>` is a Ruby-style tilde. The `~v` strips the
`v` prefix. We need to decide whether to support these.

### Range Satisfaction -- Exclude (`test/fixtures/range-exclude.js`)

All entries where version is NOT in range. Same categories as include but with
non-matching versions. Key strict-mode cases:

Prerelease exclusion (default behavior without `includePrerelease`):

```text
'^1.2.3'   does NOT satisfy '1.2.3-pre'
'^1.2'     does NOT satisfy '1.2.0-pre'
'>1.2'     does NOT satisfy '1.3.0-beta'
'<=1.2.3'  does NOT satisfy '1.2.3-beta'
'=0.7.x'   does NOT satisfy '0.7.0-asdf'
'>=0.7.x'  does NOT satisfy '0.7.0-asdf'
'<=0.7.x'  does NOT satisfy '0.7.0-asdf'
'<1.2.3'   does NOT satisfy '1.2.3-beta'
'=1.2.3'   does NOT satisfy '1.2.3-beta'
'^0.0.1'   does NOT satisfy '0.0.2-alpha'
'^1.2.3'   does NOT satisfy '2.0.0-alpha'
```

Invalid versions never satisfy:

```text
'*'        does NOT satisfy 'not a version'
'>=2'      does NOT satisfy 'glorp'
'>=2'      does NOT satisfy false
```

### Increments (`test/fixtures/increments.js`)

Format: `[version, incType, expected, options, identifier, identifierBase]`

**Strict-mode entries (no options or `false`):**

Basic bumps:

```text
'1.2.3' + major     -> '2.0.0'
'1.2.3' + minor     -> '1.3.0'
'1.2.3' + patch     -> '1.2.4'
'1.2.3' + fake      -> null (invalid increment type)
'fake'  + major     -> null (invalid version)
```

Prerelease version bumps:

```text
'1.2.3-4'           + major -> '2.0.0'
'1.2.3-4'           + minor -> '1.3.0'
'1.2.3-4'           + patch -> '1.2.3'   (drops prerelease)
'1.2.3-alpha.0.beta' + major -> '2.0.0'
'1.2.3-alpha.0.beta' + minor -> '1.3.0'
'1.2.3-alpha.0.beta' + patch -> '1.2.3'
'1.2.0-0'           + patch -> '1.2.0'   (drops prerelease, no patch bump)
```

Prerelease increment:

```text
'1.2.4'             + prerelease -> '1.2.5-0'
'1.2.3-0'           + prerelease -> '1.2.3-1'
'1.2.3-alpha.0'     + prerelease -> '1.2.3-alpha.1'
'1.2.3-alpha.1'     + prerelease -> '1.2.3-alpha.2'
'1.2.3-alpha.0.beta' + prerelease -> '1.2.3-alpha.1.beta'
'1.2.3-alpha.10.0.beta' + prerelease -> '1.2.3-alpha.10.1.beta'
'1.2.3-alpha.10.beta.0' + prerelease -> '1.2.3-alpha.10.beta.1'
'1.2.3-alpha.9.beta' + prerelease -> '1.2.3-alpha.10.beta'
```

Pre-bump types:

```text
'1.2.0' + prepatch  -> '1.2.1-0'
'1.2.0' + preminor  -> '1.3.0-0'
'1.2.0' + premajor  -> '2.0.0-0'
```

Release from prerelease:

```text
'1.0.0-1' + release -> '1.0.0'
'1.2.0-1' + release -> '1.2.0'
'1.2.3-1' + release -> '1.2.3'
'1.2.3'   + release -> null (already a release)
```

With identifier:

```text
'1.2.4'       + prerelease + 'dev'   -> '1.2.5-dev.0'
'1.2.3-0'     + prerelease + 'dev'   -> '1.2.3-dev.0'
'1.2.3-alpha.0' + prerelease + 'dev' -> '1.2.3-dev.0'
'1.2.3-alpha.0' + prerelease + 'alpha' -> '1.2.3-alpha.1'
'1.2.0'       + prepatch + 'dev'     -> '1.2.1-dev.0'
'1.2.0'       + preminor + 'dev'     -> '1.3.0-dev.0'
'1.2.0'       + premajor + 'dev'     -> '2.0.0-dev.0'
```

With identifierBase:

```text
'1.2.0-1'     + prerelease + 'alpha' + '0' -> '1.2.0-alpha.0'
'1.2.1'       + prerelease + 'alpha' + '0' -> '1.2.2-alpha.0'
'1.2.2'       + prerelease + 'alpha' + '1' -> '1.2.3-alpha.1'
'1.2.0'       + prepatch + 'dev' + '1'     -> '1.2.1-dev.1'
```

### Diff Test Cases (`test/functions/diff.js`)

Format: `[v1, v2, result]`

```text
'1.2.3' vs '0.2.3'           -> 'major'
'1.2.3' vs '2.0.0-pre'       -> 'premajor'
'1.2.3' vs '1.3.3'           -> 'minor'
'1.0.1' vs '1.1.0-pre'       -> 'preminor'
'1.2.3' vs '1.2.4'           -> 'patch'
'1.2.3' vs '1.2.4-pre'       -> 'prepatch'
'0.0.1' vs '0.0.1-pre'       -> 'patch'
'1.1.0' vs '1.1.0-pre'       -> 'minor'
'1.1.0-pre-1' vs '1.1.0-pre-2' -> 'prerelease'
'1.0.0' vs '1.0.0'           -> null
'1.0.0-1' vs '1.0.0-1'       -> null

(edge cases with prerelease versions)
'0.0.2-1' vs '0.0.2'         -> 'patch'
'0.0.2-1' vs '0.0.3'         -> 'patch'
'0.0.2-1' vs '0.1.0'         -> 'minor'
'0.0.2-1' vs '1.0.0'         -> 'major'
'0.1.0-1' vs '0.1.0'         -> 'minor'
'1.0.0-1' vs '1.0.0'         -> 'major'
'1.0.0-1' vs '1.1.1'         -> 'major'
'1.0.0-1' vs '2.1.1'         -> 'major'
'1.0.1-1' vs '1.0.1'         -> 'patch'
'0.0.0-1' vs '0.0.0'         -> 'major'
'1.0.0-1' vs '2.0.0'         -> 'major'
'1.0.0-1' vs '2.0.0-1'       -> 'premajor'
'1.0.0-1' vs '1.1.0-1'       -> 'preminor'
'1.0.0-1' vs '1.0.1-1'       -> 'prepatch'
```

### Min-Version Test Cases (`test/ranges/min-version.js`)

```text
Stars:     '*' -> '0.0.0',  '* || >=2' -> '0.0.0'
Equal:     '1.0.0' -> '1.0.0',  '1.0' -> '1.0.0',  '1.0.x' -> '1.0.0'
Tilde:     '~1.1.1' -> '1.1.1',  '~1.1.1-beta' -> '1.1.1-beta'
Caret:     '^1.1.1' -> '1.1.1',  '^1.1.1-beta' -> '1.1.1-beta'
Hyphen:    '1.1.1 - 1.8.0' -> '1.1.1',  '1.1 - 1.8.0' -> '1.1.0'
Less:      '<2' -> '0.0.0',  '<0.0.0-beta' -> '0.0.0-0',  '<0.0.1-beta' -> '0.0.0'
Greater:   '>1.0.0' -> '1.0.1',  '>1.0.0-0' -> '1.0.0-0.0',  '>1.0.0-beta' -> '1.0.0-beta.0'
LessEq:    '<=2 || >=4' -> '0.0.0'
Compound:  '>=1.1.1 <2 || >=2.2.2 <2' -> '1.1.1'
Between:   '<0.0.0-beta >0.0.0-alpha' -> '0.0.0-alpha.0'
Impossible: '>4 <3' -> null
```

### Subset Test Cases (`test/ranges/subset.js`)

90+ cases testing whether one range is a subset of another. Key patterns:

```text
'1.2.3' subset of '1.2.3'        -> true
'1.2.3' subset of '1.x'          -> true
'1.2.3' subset of '*'            -> true
'^1.2.3' subset of '*'           -> true
'1 || 2 || 3' subset of '>=1.0.0' -> true
'>=1.0.0 <2.0.0' subset of '<2.0.0' -> true
'>=1.0.0' subset of '>=1.0.0 <2.0.0' -> false
'<2.0.0' subset of '>=1.0.0 <2.0.0' -> false
'^2 || ^3 || ^4' subset of '>=1' -> true
'^2' subset of '^2 || ^3 || ^4'  -> true
'>=1.0.0 <=1.0.0' subset of '1.0.0' -> true
'>2 <1' subset of '3'            -> true (null set)
```

---

## Strict vs Loose Divergences

### Features We SKIP (loose mode / coercion)

1. **`v` prefix parsing:** `v1.2.3` parsed as `1.2.3`. node-semver accepts
   this in strict mode for the `SemVer` class constructor (it strips `v`), but
   this is NOT SemVer 2.0.0 compliant.

   **Decision needed:** node-semver's `valid-versions.js` includes `v1.2.3`.
   The `comparisons.js` fixture includes many `v`-prefixed entries. The
   `equality.js` fixture is almost entirely loose-mode `v`/`=`/whitespace
   tests. We must filter these out.

2. **`=` prefix:** `=1.2.3` treated as `1.2.3`. Only in comparators, not
   version strings (though equality fixture uses it for versions with loose).

3. **Whitespace tolerance in versions:** `' 1.2.3'`, `'1.2.3 '` -- only in
   loose mode. Strict mode trims in node-semver too, but we reject whitespace.

4. **`coerce()` function:** Entirely loose. Extracts semver from arbitrary
   strings. We do not implement this.

5. **`clean()` function:** Trims whitespace and strips `v`/`=`. We could
   implement a strict subset (trim only) or skip entirely.

6. **Loose-mode range parsing:** `>01.02.03` accepted as `>1.2.3`,
   `~1.2.3beta` accepted as `~1.2.3-beta`. We reject these.

7. **`~>` syntax (Ruby-style tilde):** node-semver accepts `~>3.2.1` in
   strict mode as `>=3.2.1 <3.3.0-0`. This is NOT standard SemVer but is
   widely used. **Decision needed.**

8. **`~v` syntax:** `~v0.5.4-pre` accepted in strict mode. Strips the `v`.
   **Decision needed.**

9. **`=` in comparators:** `=0.7.x` accepted in strict mode. This is standard
   node-semver behavior.

10. **`includePrerelease` option:** Not loose, but a separate semantic. We
    should support this as it's a legitimate range-matching mode.

### Entries Requiring Loose Mode (must SKIP in our tests)

**Comparisons fixture:** All entries with `true` as third arg (12 of 32 entries).

**Equality fixture:** All entries with `true` as third arg (35 of 37 entries).
Only 2 entries work in strict mode:

* `'1.2.3-beta+build' == '1.2.3-beta+otherbuild'`
* `'1.2.3+build' == '1.2.3+otherbuild'`

**Range-include fixture:** Entries with `true` or `{ loose: ... }` as options.
~10 entries are loose-only.

**Range-exclude fixture:** ~8 entries with `true` or loose options.

**Range-parse fixture:** ~5 entries with `true` (loose) options.

**Increments fixture:** ~4 entries with `true` (loose) options (e.g.,
`'1.2.3tag'` which requires loose parsing).

### Entries with `includePrerelease` (KEEP -- not loose)

These use `{ includePrerelease: true }` and are legitimate strict-mode tests:

* range-include: ~15 entries
* range-exclude: ~15 entries
* range-parse: ~5 entries
* subset: ~8 entries

---

## Coverage Gaps

### Areas Where node-semver Tests Are Thin

1. **Invalid version strings:** Only 10 entries in the fixture. Missing cases:
   * Leading zeros: `01.0.0`, `1.02.0`, `1.0.03`
   * Leading zeros in prerelease: `1.0.0-01`, `1.0.0-alpha.01`
   * Empty string: `''`
   * Whitespace only: `'  '`
   * Trailing dot: `'1.2.3.'`
   * Extra dots: `'1.2.3.4'` (tested inline but not in fixture)
   * Missing components: `'1.2'`, `'1'` (these are valid ranges but invalid versions)
   * Negative numbers: `'-1.0.0'`
   * Empty prerelease: `'1.0.0-'`
   * Empty build: `'1.0.0+'`
   * Empty prerelease identifier: `'1.0.0-alpha..beta'`
   * Overflow: large but not MAX_SAFE_INTEGER (e.g., `2^53`)
   * Unicode: `'1.0.0-\u00e9'`

2. **Version equality in strict mode:** The equality fixture is almost entirely
   loose-mode. Strict-mode equality testing (build metadata ignored) has only
   2-3 cases. We need more:
   * `1.0.0+a == 1.0.0+b`
   * `1.0.0-alpha+a == 1.0.0-alpha+b`
   * `0.0.0 == 0.0.0`
   * `1.2.3-alpha.1 == 1.2.3-alpha.1`

3. **Prerelease ordering edge cases:** Good coverage but could add:
   * `1.0.0-0` vs `1.0.0-0.0` (shorter vs longer starting same)
   * `1.0.0-alpha` vs `1.0.0-alpha.0` (string then numeric)
   * Empty prerelease array vs non-empty (release vs prerelease)

4. **Build metadata in ranges:** Well covered by recent additions to
   `range-parse.js`, but satisfaction tests with build metadata in versions
   are sparse.

5. **Error position reporting:** node-semver does NOT test error positions at
   all (it uses regex, not a parser). This is entirely our responsibility.

6. **Boundary values:**
   * `0.0.0` as minimum version in ranges
   * `MAX_SAFE_INTEGER.MAX_SAFE_INTEGER.MAX_SAFE_INTEGER` as maximum
   * Version `0.0.0-0` (minimum possible with prerelease)

7. **Range edge cases:**
   * Deeply nested unions: `a || b || c || d || e`
   * Single-version ranges: `1.2.3`
   * Impossible ranges: `>2.0.0 <1.0.0`
   * `>0.0.0-0` (matches everything with prerelease)

8. **Whitespace handling in ranges:** Covered by `whitespace.js` integration
   test for ReDoS, but semantic whitespace normalization tests are light.

9. **Comparator test method with build metadata:** No tests for whether
   `1.2.3+build` satisfies `>=1.2.3`.

10. **Hash consistency:** node-semver doesn't use hashing. We need tests to
    verify `Hash.hash(v("1.0.0+a")) === Hash.hash(v("1.0.0+b"))`.

---

## Test Data Extraction

### Valid Versions for Our Tests

These are strictly valid SemVer 2.0.0 strings (no `v` prefix):

```typescript
const VALID_VERSIONS = [
  // Basic
  { input: '0.0.0', major: 0, minor: 0, patch: 0, prerelease: [], build: [] },
  { input: '1.0.0', major: 1, minor: 0, patch: 0, prerelease: [], build: [] },
  { input: '2.1.0', major: 2, minor: 1, patch: 0, prerelease: [], build: [] },
  { input: '3.2.1', major: 3, minor: 2, patch: 1, prerelease: [], build: [] },
  { input: '999.999.999', major: 999, minor: 999, patch: 999, prerelease: [], build: [] },

  // Prerelease
  { input: '1.2.3-0', major: 1, minor: 2, patch: 3, prerelease: [0], build: [] },
  { input: '1.2.3-123', major: 1, minor: 2, patch: 3, prerelease: [123], build: [] },
  { input: '1.2.3-1.2.3', major: 1, minor: 2, patch: 3, prerelease: [1, 2, 3], build: [] },
  { input: '1.2.3-1a', major: 1, minor: 2, patch: 3, prerelease: ['1a'], build: [] },
  { input: '1.2.3-a1', major: 1, minor: 2, patch: 3, prerelease: ['a1'], build: [] },
  { input: '1.2.3-alpha', major: 1, minor: 2, patch: 3, prerelease: ['alpha'], build: [] },
  { input: '1.2.3-alpha.1', major: 1, minor: 2, patch: 3, prerelease: ['alpha', 1], build: [] },
  { input: '1.2.3-alpha-1', major: 1, minor: 2, patch: 3, prerelease: ['alpha-1'], build: [] },
  { input: '1.2.3-alpha-.-beta', major: 1, minor: 2, patch: 3, prerelease: ['alpha-', '-beta'], build: [] },
  { input: '1.0.0-x.7.z.92', major: 1, minor: 0, patch: 0, prerelease: ['x', 7, 'z', 92], build: [] },
  { input: '1.0.0-0.3.7', major: 1, minor: 0, patch: 0, prerelease: [0, 3, 7], build: [] },

  // Build metadata
  { input: '1.2.3+456', major: 1, minor: 2, patch: 3, prerelease: [], build: ['456'] },
  { input: '1.2.3+build', major: 1, minor: 2, patch: 3, prerelease: [], build: ['build'] },
  { input: '1.2.3+new-build', major: 1, minor: 2, patch: 3, prerelease: [], build: ['new-build'] },
  { input: '1.2.3+build.1', major: 1, minor: 2, patch: 3, prerelease: [], build: ['build', '1'] },
  { input: '1.2.3+build.1a', major: 1, minor: 2, patch: 3, prerelease: [], build: ['build', '1a'] },
  { input: '1.2.3+build.a1', major: 1, minor: 2, patch: 3, prerelease: [], build: ['build', 'a1'] },
  { input: '1.2.3+build.alpha', major: 1, minor: 2, patch: 3, prerelease: [], build: ['build', 'alpha'] },
  { input: '1.2.3+build.alpha.beta', major: 1, minor: 2, patch: 3, prerelease: [], build: ['build', 'alpha', 'beta'] },
  { input: '1.0.0+20130313144700', major: 1, minor: 0, patch: 0, prerelease: [], build: ['20130313144700'] },

  // Combined prerelease + build
  { input: '1.2.3-alpha+build', major: 1, minor: 2, patch: 3, prerelease: ['alpha'], build: ['build'] },
  { input: '1.0.0-alpha+001', major: 1, minor: 0, patch: 0, prerelease: ['alpha'], build: ['001'] },
]
```

### Invalid Versions for Our Tests

```typescript
const INVALID_VERSIONS = [
  // From node-semver fixture (adapted)
  { input: 'hello, world', reason: 'not a version string' },
  { input: 'xyz', reason: 'not a version string' },

  // Leading zeros (NOT in node-semver fixture -- we must add)
  { input: '01.0.0', reason: 'leading zero in major' },
  { input: '1.02.0', reason: 'leading zero in minor' },
  { input: '1.0.03', reason: 'leading zero in patch' },
  { input: '1.0.0-01', reason: 'leading zero in numeric prerelease' },
  { input: '1.0.0-alpha.01', reason: 'leading zero in numeric prerelease identifier' },

  // Structural
  { input: '', reason: 'empty string' },
  { input: '  ', reason: 'whitespace only' },
  { input: ' 1.0.0', reason: 'leading whitespace' },
  { input: '1.0.0 ', reason: 'trailing whitespace' },
  { input: '1.2', reason: 'missing patch component' },
  { input: '1', reason: 'missing minor and patch' },
  { input: '1.2.3.4', reason: 'extra numeric component' },
  { input: '1.2.3.', reason: 'trailing dot' },
  { input: '.1.2.3', reason: 'leading dot' },
  { input: '1..2.3', reason: 'double dot' },

  // Prerelease
  { input: '1.0.0-', reason: 'empty prerelease' },
  { input: '1.0.0-alpha..beta', reason: 'empty prerelease identifier' },
  { input: '1.0.0-.alpha', reason: 'empty first prerelease identifier' },

  // Build
  { input: '1.0.0+', reason: 'empty build metadata' },
  { input: '1.0.0+build..1', reason: 'empty build identifier' },

  // Prefix (strict mode rejects)
  { input: 'v1.2.3', reason: 'v prefix not allowed in strict mode' },
  { input: '=1.2.3', reason: '= prefix not allowed' },

  // Non-string types
  { input: null, reason: 'null is not a string' },
  { input: undefined, reason: 'undefined is not a string' },
  { input: 123, reason: 'number is not a string' },
  { input: true, reason: 'boolean is not a string' },

  // Overflow
  { input: '99999999999999999.0.0', reason: 'major exceeds safe integer' },
  { input: '0.99999999999999999.0', reason: 'minor exceeds safe integer' },
  { input: '0.0.99999999999999999', reason: 'patch exceeds safe integer' },

  // Negative
  { input: '-1.0.0', reason: 'negative major' },

  // Unicode
  { input: '1.0.0-\u00e9', reason: 'non-ASCII in prerelease' },

  // Too long
  { input: '1'.repeat(255) + '.0.0', reason: 'exceeds max length' },
]
```

### Comparison Pairs for Our Tests (strict mode only)

```typescript
// [v1, v2] where v1 > v2
const COMPARISONS = [
  ['0.0.0', '0.0.0-foo'],
  ['0.0.1', '0.0.0'],
  ['1.0.0', '0.9.9'],
  ['0.10.0', '0.9.0'],
  ['0.99.0', '0.10.0'],
  ['2.0.0', '1.2.3'],
  ['1.2.3', '1.2.3-asdf'],
  ['1.2.3', '1.2.3-4'],
  ['1.2.3', '1.2.3-4-foo'],
  ['1.2.3-5-foo', '1.2.3-5'],
  ['1.2.3-5', '1.2.3-4'],
  ['1.2.3-5-foo', '1.2.3-5-Foo'],
  ['3.0.0', '2.7.2+asdf'],
  ['1.2.3-a.10', '1.2.3-a.5'],
  ['1.2.3-a.b', '1.2.3-a.5'],
  ['1.2.3-a.b', '1.2.3-a'],
  ['1.2.3-a.b.c.10.d.5', '1.2.3-a.b.c.5.d.100'],
  ['1.2.3-r2', '1.2.3-r100'],
  ['1.2.3-r100', '1.2.3-R2'],
]
```

### Equality Pairs for Our Tests (strict mode only)

```typescript
// [v1, v2] where v1 == v2
const EQUALITIES = [
  ['1.2.3-beta+build', '1.2.3-beta+otherbuild'],
  ['1.2.3+build', '1.2.3+otherbuild'],
  // Additional cases we should add:
  ['0.0.0', '0.0.0'],
  ['1.0.0', '1.0.0'],
  ['1.2.3', '1.2.3'],
  ['1.2.3-alpha', '1.2.3-alpha'],
  ['1.2.3-alpha.1', '1.2.3-alpha.1'],
  ['1.0.0+a', '1.0.0+b'],
  ['1.0.0+a.b.c', '1.0.0+x.y.z'],
  ['1.0.0-alpha+a', '1.0.0-alpha+b'],
]
```

### Range Parse Expectations for Our Tests

See the [Range Parse section above](#range-parse-testfixturesrange-parsejs) for
the full catalog. Key strict-mode data is extracted there.

### Range Satisfaction for Our Tests

See the [Range Include](#range-satisfaction----include-testfixturesrange-includejs)
and [Range Exclude](#range-satisfaction----exclude-testfixturesrange-excludejs)
sections above. Filter out entries with `true` or `{ loose: ... }` options for
strict mode.

---

## Recommended Test Structure

### File Organization

Based on node-semver's coverage patterns and our testing.md design:

```text
__test__/
  fixtures/
    valid-versions.ts          -- Valid version data (from node-semver + additions)
    invalid-versions.ts        -- Invalid version data (greatly expanded)
    comparisons.ts             -- Comparison pairs (strict only)
    equality.ts                -- Equality pairs (strict only, expanded)
    range-parse.ts             -- Range parse expectations (strict only)
    range-include.ts           -- Range satisfaction positive (strict only)
    range-exclude.ts           -- Range satisfaction negative (strict only)
    increments.ts              -- Increment expectations (strict only)
    diff.ts                    -- Version diff expectations
  SemVer.test.ts               -- Version parsing, construction, traits
  SemVerOrder.test.ts          -- Ordering and comparison
  SemVerEqual.test.ts          -- Equality and hashing (build metadata)
  SemVerBump.test.ts           -- Increment operations
  SemVerDiff.test.ts           -- Diff operations
  Range.test.ts                -- Range parsing and desugaring
  RangeSatisfy.test.ts         -- Range satisfaction (satisfies/gtr/ltr)
  Comparator.test.ts           -- Comparator construction and matching
  SemVerParser.test.ts         -- Parser error positions and edge cases
  VersionCache.test.ts         -- Service operations and concurrency
  errors.test.ts               -- Error construction and fields
```

### Fixture File Format

Use typed arrays for compile-time safety:

```typescript
// fixtures/valid-versions.ts
export interface ValidVersion {
  readonly input: string
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly prerelease: ReadonlyArray<string | number>
  readonly build: ReadonlyArray<string>
}

export const VALID_VERSIONS: ReadonlyArray<ValidVersion> = [
  // ...
] as const
```

### Test Categories to Cover

1. **Version Parsing** (from `valid-versions`, `invalid-versions` fixtures)
   * Valid construction with all component verification
   * Invalid input rejection with typed error assertions
   * Error position accuracy for every failure mode

2. **Version Ordering** (from `comparisons` fixture)
   * All comparison pairs from node-semver (strict only)
   * Additional prerelease ordering edge cases
   * Build metadata ignored in comparisons

3. **Version Equality** (expanded from `equality` fixture)
   * Build metadata equality
   * Hash consistency
   * Equal trait implementation

4. **Range Parsing** (from `range-parse` fixture)
   * Every syntactic sugar form desugars correctly
   * Invalid ranges produce typed errors
   * Canonical string representation matches

5. **Range Satisfaction** (from `range-include`, `range-exclude` fixtures)
   * Positive: version is in range
   * Negative: version is NOT in range
   * includePrerelease semantics

6. **Version Bumping** (from `increments` fixture)
   * All increment types
   * Prerelease identifier handling
   * Immutability verification

7. **Version Diff** (from inline `diff.js` data)
   * All diff type results
   * Null for equal versions

8. **Boundary Operations** (from `min-version`, `max-satisfying`, `min-satisfying`)
   * Minimum version of a range
   * Max/min satisfying from a list (VersionCache operations)

9. **Range Algebra** (from `comparator-intersection`, `range-intersection`, `subset`)
   * Comparator intersection
   * Range intersection
   * Range subset

10. **Parser Error Positions** (NEW -- not in node-semver)
    * Every invalid version error includes correct character position
    * Every invalid range error includes correct character position

### Priority Ordering

**Phase 1 (Core):**

* Version parsing (valid + invalid)
* Version ordering
* Version equality + hashing
* Range parsing
* Range satisfaction

**Phase 2 (Operations):**

* Version bumping
* Version diff
* Min-version
* Max/min satisfying

**Phase 3 (Algebra):**

* Comparator intersection
* Range intersection
* Range subset
* Range simplification

### Key Differences from node-semver Test Approach

1. **No loose mode tests.** We are strict SemVer 2.0.0 only. Every loose-only
   test case from node-semver must be filtered out.

2. **Typed error assertions.** node-semver tests throw/null. We test Effect
   error channels with structural assertions (error tag, fields, position).

3. **Error position testing.** Entirely new test category. node-semver uses
   regex so has no position concept.

4. **Hash consistency.** New requirement for Effect Equal/Hash traits.

5. **Effect service isolation.** Each test gets its own Layer. node-semver
   tests are stateless functions.

6. **`v` prefix rejection.** node-semver accepts `v1.2.3` even in strict mode.
   We reject it. This means `v`-prefixed entries in ALL fixtures must be
   filtered or moved to our invalid-versions fixture.

7. **`~>` and `~v` syntax decision.** node-semver accepts these in strict
   mode. We need to decide whether to support them. They are NOT part of the
   node-semver range BNF grammar but are handled by the regex.

### BNF Grammar Reference

node-semver's `range.bnf` defines the grammar:

```text
range-set  ::= range ( logical-or range ) *
logical-or ::= ( ' ' ) * '||' ( ' ' ) *
range      ::= hyphen | simple ( ' ' simple ) * | ''
hyphen     ::= partial ' - ' partial
simple     ::= primitive | partial | tilde | caret
primitive  ::= ( '<' | '>' | '>=' | '<=' | '=' ) partial
partial    ::= xr ( '.' xr ( '.' xr qualifier ? )? )?
xr         ::= 'x' | 'X' | '*' | nr
nr         ::= '0' | [1-9] ( [0-9] ) *
tilde      ::= '~' partial
caret      ::= '^' partial
qualifier  ::= ( '-' pre )? ( '+' build )?
pre        ::= prepart ( '.' prepart ) *
prepart    ::= nr | alphanumid
build      ::= buildid ( '.' buildid ) *
alphanumid ::= ( [0-9] ) * [A-Za-z-] [-0-9A-Za-z] *
buildid    ::= [-0-9A-Za-z]+
```

Note: `~>` is NOT in this grammar. It is handled separately by regex.

---

## Summary of Constants

From `internal/constants.js`:

```text
MAX_LENGTH = 256           (max version string length)
MAX_SAFE_INTEGER = 2^53-1  (Number.MAX_SAFE_INTEGER)
MAX_SAFE_COMPONENT_LENGTH = 16  (max digits in a single component for coercion)
MAX_SAFE_BUILD_LENGTH = 250     (MAX_LENGTH - 6)
```

We should adopt `MAX_LENGTH` and `MAX_SAFE_INTEGER` for our implementation.
`MAX_SAFE_COMPONENT_LENGTH` is only for coercion (which we skip).
