# node-semver Issue Analysis

Research into open and closed issues from
[npm/node-semver](https://github.com/npm/node-semver) to inform our
semver-effect implementation.

**Date:** 2026-03-10
**Source:** GitHub issues (open and closed) from npm/node-semver
**Purpose:** Identify pain points, feature gaps, edge cases, and opportunities
for our Effect-native SemVer implementation.

---

## Table of Contents

1. [Open Issue Inventory](#open-issue-inventory)
2. [Pain Points](#pain-points)
3. [Feature Gaps](#feature-gaps)
4. [Edge Case Bugs](#edge-case-bugs)
5. [TypeScript / Type Safety Issues](#typescript--type-safety-issues)
6. [Performance Concerns](#performance-concerns)
7. [Recommendations](#recommendations)

---

## Open Issue Inventory

### High Relevance

| # | Title | Why It Matters |
| :-- | :-- | :-- |
| [#501](https://github.com/npm/node-semver/issues/501) | [TRACKING] `semver@8` | Tracks all planned breaking changes for v8. Many items overlap with our design goals (strict mode, ESM, cloning, error-throwing satisfies). Shows what the maintainers acknowledge as broken. |
| [#418](https://github.com/npm/node-semver/issues/418) | [FEATURE] Allow satisfies to throw errors | Users want to distinguish "version doesn't satisfy range" from "range is invalid." Our Effect-based approach solves this inherently via typed error channels. |
| [#458](https://github.com/npm/node-semver/issues/458) | [BUG] SemVer.compare causes spurious allocations | Performance: `compare()` creates new SemVer objects even when inputs are already SemVer instances. Our immutable Schema.TaggedClass approach avoids this entirely. |
| [#578](https://github.com/npm/node-semver/issues/578) | Suggest refactoring prerelease into its own class | Observation that many bugs stem from prerelease handling. Our design already treats prerelease as a structured array of typed identifiers. |
| [#757](https://github.com/npm/node-semver/issues/757) | [BUG] subset() incorrectly returns false for prerelease versions | Range algebra bug: `subset()` fails for prerelease ranges that should be subsets. Directly relevant to our `Range.isSubset` implementation. |
| [#703](https://github.com/npm/node-semver/issues/703) | [BUG] `subset('>=17.2.0', '^17.2.0 \|\| >17')` should be true | Another `subset()` bug with OR ranges. Our algebraic subset check must handle this correctly. |
| [#712](https://github.com/npm/node-semver/issues/712) | [ENHANCEMENT] Publish as ESM | node-semver is CJS-only. Our package is ESM-only from day one. |
| [#691](https://github.com/npm/node-semver/issues/691) | [BUG] limit version prefix to optional `v` | node-semver accepts `v=1.2.3`, `vvv1.2.3`, `v==1.2.3` as valid. Tracked for v8 fix. Our strict parser rejects all of these. |
| [#378](https://github.com/npm/node-semver/issues/378) | [ENHANCEMENT] add ability to clone a semver instance | SemVer is mutable in node-semver so users need cloning. Our immutable Schema.TaggedClass eliminates this need. |
| [#354](https://github.com/npm/node-semver/issues/354) | [BUG] dangerous instanceof check in SemVer constructor | `instanceof SemVer` breaks across package versions. Our Schema.TaggedClass with structural `Equal` avoids this. |

### Medium Relevance

| # | Title | Why It Matters |
| :-- | :-- | :-- |
| [#802](https://github.com/npm/node-semver/issues/802) | Why does `>1.2` throw as an invalid comparator? | Partial versions in ranges cause confusion. Our strict parser should have clear error messages for these. |
| [#799](https://github.com/npm/node-semver/issues/799) | [BUG] Test fixture includes case outside of range | `includePrerelease` changes range boundaries, not just matching. Documents a subtle spec interpretation issue. |
| [#751](https://github.com/npm/node-semver/issues/751) | [BUG] inc premajor/preminor/prepatch wrong for pre-releases | `inc('premajor')` on an existing prerelease does unexpected things. We should define clear bump semantics. |
| [#736](https://github.com/npm/node-semver/issues/736) | [ENHANCEMENT] Allow *prerelease for* ranges | Users want `*` range to include prereleases. Relates to our prerelease matching design. |
| [#721](https://github.com/npm/node-semver/issues/721) | [QUESTION] Confusing pre-release range matching | Long-standing user confusion about prerelease behavior in ranges. Opportunity for better documentation and clearer semantics. |
| [#557](https://github.com/npm/node-semver/issues/557) | [BUG] Inconsistent caret + includePrerelease behavior | Caret ranges behave differently with `includePrerelease` depending on version. Edge case for our matching logic. |
| [#512](https://github.com/npm/node-semver/issues/512) | [BUG] Tilde range not equivalent to X-range with prerelease | `~1.2.*` should include prereleases when `includePrerelease` is set, but doesn't. Desugaring edge case. |
| [#511](https://github.com/npm/node-semver/issues/511) | [BUG] Numerical versions after X-ranges ignored | `1.x.5` is treated as `1.x.x` silently. Our strict parser should reject this outright. |
| [#483](https://github.com/npm/node-semver/issues/483) | [BUG] semver.lt wrong for pre-release comparison | Pre-release comparison bug. Core precedence logic we must get right. |
| [#468](https://github.com/npm/node-semver/issues/468) | [QUESTION] Comma-separated constraints | Composer/PHP uses commas as AND; node-semver uses spaces. Out of scope but worth documenting. |
| [#396](https://github.com/npm/node-semver/issues/396) | [BUG] Range returns prerelease even when includePrerelease is false | Range object construction includes prerelease versions it shouldn't. |
| [#392](https://github.com/npm/node-semver/issues/392) | [BUG] range.bnf incomplete regarding whitespace | BNF grammar has discrepancies with the implementation. Our recursive descent parser must have a well-defined grammar. |
| [#387](https://github.com/npm/node-semver/issues/387) | [BUG] should throw error when invalid range with loose=true | Even loose mode should reject certain inputs. We don't have loose mode, but validates our strict approach. |
| [#381](https://github.com/npm/node-semver/issues/381) | [BUG] not compatible with Rollup due to require cycle | CJS circular dependency issues. Our ESM-only, no-barrel approach avoids this. |
| [#345](https://github.com/npm/node-semver/issues/345) | [QUESTION] intersects with includePrereleases | `intersects()` returns incorrect results with prerelease + includePrerelease option. Must test extensively. |
| [#344](https://github.com/npm/node-semver/issues/344) | [QUESTION] Major version 0 and the spec | How should `^0.x.y` behave? Spec says 0.y.z is "anything goes." Important for our caret desugaring. |
| [#314](https://github.com/npm/node-semver/issues/314) | [FEATURE] Add methods to update a range | Users want to programmatically modify ranges (change operator, bump version). Possible future enhancement. |
| [#307](https://github.com/npm/node-semver/issues/307) | [BUG?] Possible issues in internal/re.js | Regex construction problems in the parser. Validates our decision to use recursive descent instead. |
| [#610](https://github.com/npm/node-semver/issues/610) | Satisfying functions don't compare build metadata | Users sometimes need build metadata comparisons. Our diff already captures build changes. |

### Low Relevance

| # | Title | Why It Matters |
| :-- | :-- | :-- |
| [#649](https://github.com/npm/node-semver/issues/649) | [ENHANCEMENT] minimum version relative to | Niche feature request for min-version queries. Our VersionCache partially addresses this. |
| [#499](https://github.com/npm/node-semver/issues/499) | [ENHANCEMENT] Rewrite CLI | CLI rewrite for v8. Out of scope for us (we're a library). |
| [#498](https://github.com/npm/node-semver/issues/498) | [ENHANCEMENT] Remove individual file requires | Internal restructuring. Not relevant to us. |
| [#352](https://github.com/npm/node-semver/issues/352) | [FEATURE] Coerce an identifier | Coercion of prerelease identifiers. We don't do coercion. |
| [#350](https://github.com/npm/node-semver/issues/350) | [FEATURE] Check validity of prerelease identifier | We solve this via typed parsing. |
| [#226](https://github.com/npm/node-semver/issues/226) | Pre-release id version do not update with provided pre-release id | `inc()` with preid behavior. Edge case for our bump operations. |
| [#164](https://github.com/npm/node-semver/issues/164) | Incorrect loose parsing | Loose mode edge cases. We don't have loose mode. |
| [#153](https://github.com/npm/node-semver/issues/153) | [FEATURE] CLI prerelease check | CLI feature. Out of scope. |
| [#149](https://github.com/npm/node-semver/issues/149) | [FEATURE] Pipe into semver CLI | CLI feature. Out of scope. |
| [#108](https://github.com/npm/node-semver/issues/108) | CLI accepts invalid increment specifiers | CLI validation bug. Out of scope. |
| [#48](https://github.com/npm/node-semver/issues/48) | [FEATURE] decrement/truncate | `semver.truncate('1.2.3-foo', 'patch') == '1.2.3'`. Interesting utility; could be a Phase 3 feature for us. |
| [#729](https://github.com/npm/node-semver/issues/729) | Wrong results on semver.npmjs.com | Website bug, not library bug. |

---

## Pain Points

### 1. Prerelease Behavior Is Confusing and Buggy

This is the single largest source of issues. At least 15 open and closed
issues relate to prerelease handling:

- **Matching confusion** (#721, #557, #512, #736): Users don't understand
  when prerelease versions are included or excluded in range matching.
  The rule that prereleases only match if a comparator shares the same
  `[major, minor, patch]` tuple is surprising and poorly documented.

- **includePrerelease inconsistency** (#799, #557, #345, #396): The
  `includePrerelease` option changes behavior in unexpected ways, sometimes
  altering the range boundaries themselves rather than just matching rules.

- **subset/intersect bugs with prereleases** (#757, #345, #521): Range
  algebra functions produce wrong results when prerelease versions are
  involved.

- **Prerelease comparison bugs** (#483, #30): Numeric vs. alphanumeric
  identifier comparison and mixed-length prerelease arrays cause incorrect
  ordering.

**Our opportunity:** Our strict prerelease handling (typed identifiers,
explicit comparison rules from SemVer 2.0.0 Section 11) and comprehensive
tests can be a major differentiator.

### 2. Null Returns Instead of Errors

Multiple issues (#219, #763, #191, #305) stem from node-semver returning
`null` for invalid inputs instead of throwing errors:

- `semver.valid()` returns `null` for ranges (not versions), confusing users
- `semver.inc()` silently returns `null` for invalid preid values
- `semver.clean()` returns `null` without explaining why
- Functions that return `null` propagate to downstream code as runtime errors

**Our opportunity:** Every operation returns an Effect with typed errors. The
error includes the input string and (for parse errors) the position. Users
never see `null`.

### 3. Loose Mode Is Unpredictable

Issues #164, #387, #168, #237 show that loose mode accepts inputs users
don't expect and rejects inputs they do expect:

- Loose mode accepts `9.4.146.3.32.12.2` as valid
- Loose mode still rejects `2.0` (two-part version)
- Loose mode doesn't consistently handle leading zeros in prerelease

**Our opportunity:** We have no loose mode. Strict SemVer 2.0.0 only.
Clear parsing errors explain exactly why an input is invalid.

### 4. Mutable SemVer Objects

Issues #378 (clone request), #354 (instanceof danger), #458 (spurious
allocations) all stem from SemVer being a mutable class:

- `inc()` mutates the instance, requiring users to clone before bumping
- `instanceof` checks break across package versions
- `compare()` creates new SemVer objects as a side effect

**Our opportunity:** Immutable Schema.TaggedClass. No mutation, no
instanceof checks, structural equality via Equal trait.

### 5. Poor Error Messages

Issues #802, #191, #418 show users struggling to understand why operations
fail:

- "Invalid Version" with no indication of what character caused the failure
- `satisfies()` returns `false` for both "doesn't match" and "invalid input"
- Range parsing silently succeeds for malformed inputs

**Our opportunity:** Parser errors include position information. The typed
error channel distinguishes parse failures from match failures.

---

## Feature Gaps

Features users want that node-semver doesn't provide. Assessed for alignment
with our design.

### Aligned with Our Goals

| Feature | Source | Our Status |
| :-- | :-- | :-- |
| **Error-throwing satisfies** | #418 | Built in: Effect error channel distinguishes invalid input from non-match |
| **Range algebra (subset, intersect)** | #228, #178, #703, #757 | Phase 2: `Range.intersect`, `Range.isSubset`, `Range.equivalent` |
| **Structured diff** | (no specific issue, but requested in comments) | Phase 1: `VersionDiff` with type classification and numeric deltas |
| **Clone/immutability** | #378 | Built in: Schema.TaggedClass is immutable |
| **ESM support** | #712 | Built in: ESM-only package |
| **Prerelease as first-class type** | #578, #350 | Built in: typed prerelease identifiers in our data model |
| **Version grouping/navigation** | #649 | VersionCache: `groupBy`, `latestByMajor`, `latestByMinor`, `next`, `prev` |

### Worth Considering

| Feature | Source | Assessment |
| :-- | :-- | :-- |
| **Truncate/decrement** | #48, #46 | Low priority but simple. Could add `SemVer.truncate(level)` to strip prerelease/build. |
| **Expose parsed regex/grammar** | #456 | Our recursive descent parser doesn't use regex, but exposing the grammar rules as documentation or a validation function could be valuable. |
| **Range modification** | #314 | Programmatic range construction/modification. Could be useful for tooling. Phase 3 candidate. |
| **Build metadata comparison option** | #610 | Spec says ignore build metadata, but an opt-in comparison for CI use cases has merit. Could add `SemVer.compareWithBuild`. |

### Out of Scope

| Feature | Source | Why |
| :-- | :-- | :-- |
| Coercion | #232, #229, #248, #473, #592 | We are strict-only; no coercion |
| Loose parsing | #168, #164 | No loose mode |
| CLI features | #499, #153, #149, #108 | We are a library, not a CLI tool |
| Comma-separated constraints | #468 | Different ecosystem (Composer/PHP) |

---

## Edge Case Bugs

Bugs in node-semver that reveal edge cases we must handle correctly.

### Prerelease Comparison

- **#483 / #30:** `semver.lt('1.0.0-rc.2', '1.0.0-rc.11')` returns `false`
  (should be `true`). Numeric prerelease identifiers must be compared as
  integers, not strings. `rc` is alphanumeric (compared lexically), but `2`
  and `11` are numeric. Mixed identifier types in the same position require
  care.

- **#237:** Leading zeros in numeric prerelease identifiers
  (`2.0.0-20180101T112233.0100000.0`). Per spec, numeric identifiers must
  not have leading zeros. Our parser should reject these strictly.

- **#336:** `maxSatisfying` with caret ranges and prerelease. Caret range
  `^4.0.0-dev.20200615` should match `4.1.0-dev.20200811` but doesn't
  because prerelease matching is too restrictive.

### Range Boundary Cases

- **#521:** `intersects('< 0.0.0', '0.0.x')` incorrectly returns `true`.
  The range `< 0.0.0` matches nothing (there is no version below 0.0.0
  unless prereleases are included), so it should not intersect with anything.

- **#511:** `1.x.5` is silently treated as `1.x.x`. Partial versions with
  non-wildcard components after wildcards should be rejected.

- **#392:** The BNF grammar in the README doesn't match the implementation.
  Whitespace handling and "spermie" (spermy?) operators have undocumented
  behavior.

### Version 0.x Semantics

- **#344:** How should `^0.1.2` behave? The spec says major version 0 is
  "anything goes," but node-semver interprets `^0.1.2` as `>=0.1.2 <0.2.0`
  (pin minor). This is a convention, not in the spec. We should follow the
  same convention and document it clearly.

### inc() with Prerelease

- **#751:** `inc('1.0.0-beta.1', 'premajor')` produces `2.0.0-0` instead of
  something more intuitive. The semantics of "pre-bump on an existing
  prerelease" are ambiguous. We need clear, documented rules.

- **#226:** `inc('1.0.0-alpha.1', 'prerelease', 'beta')` should switch the
  prerelease identifier. The behavior of preid replacement is underspecified.

- **#763:** Breaking change between 7.6.0 and 7.7.0: `inc('1.0.0', 'prepatch',
  'canary.661.2207bf')` returns `null` because the preid contains a
  dot-separated component that looks numeric with leading digits. Strict
  preid validation must be clear.

### Build Metadata

- **#264:** `semver.valid('0.8.0-rc.27+test')` returns `0.8.0-rc.27`
  (strips build metadata). The `version` property of a parsed SemVer
  doesn't include build metadata. Our `SemVer.toString()` should include it;
  comparison should ignore it.

---

## TypeScript / Type Safety Issues

### null Returns Are the Root Problem

node-semver returns `null | string` from most functions, forcing callers
into null checks that provide no information about what went wrong:

```typescript
// node-semver pattern
const v = semver.valid(input);       // string | null
const r = semver.validRange(input);  // string | null
const s = semver.satisfies(v, r);    // boolean (but silently false for null)
const m = semver.maxSatisfying(vs, r); // string | null
```

Users report (#219, #763, #191) that `null` returns lead to cascading
failures when the null propagates through downstream code.

### Our Effect Approach Solves This

Every operation returns `Effect<A, E>` where E is a specific tagged error:

```typescript
// semver-effect pattern
const v = parser.parseVersion(input);
// Effect<SemVer, InvalidVersionError>

const r = parser.parseRange(input);
// Effect<Range, InvalidRangeError>

const resolved = cache.resolve(range);
// Effect<SemVer, UnsatisfiedRangeError>
```

The typed error channel means:

- Callers know exactly what can go wrong
- Pattern matching on error tags enables precise recovery
- No null checks needed anywhere in the API

### Specific Issues We Solve

| node-semver Problem | Our Solution |
| :-- | :-- |
| `satisfies()` returns `false` for invalid ranges (#418) | Separate `InvalidRangeError` from non-match |
| `valid()` returns null with no reason (#219) | `InvalidVersionError` with position info |
| `inc()` returns null for bad preid (#763) | `InvalidPrereleaseError` or `InvalidBumpError` |
| `instanceof` breaks across versions (#354) | Structural `Equal` trait, no instanceof |
| Functions accept `string \| SemVer`, complicating types | Parsed types only; parsing is explicit |

### @types/semver Lag

Issue #300 requested bundled TypeScript types (2019). As of 2026, node-semver
still relies on `@types/semver` which frequently falls behind. Our package
ships types as part of the build.

---

## Performance Concerns

### Issue #814: Comprehensive Performance Proposal

A detailed proposal (closed, not implemented) identified these bottlenecks:

1. **Range satisfaction cache:** Each `satisfies()` call creates a new Range
   object. Proposed LRU cache for repeated checks.
2. **SemVer object pooling:** Issue #458 identified spurious allocations in
   comparison operations.
3. **Sort optimization:** Schwartzian transform to avoid re-parsing during
   sort.
4. **Coercion cache:** Repeated coercion of the same strings.
5. **toString() caching:** Rebuilds string on every call.

**Claimed impact:** 35-45% improvement for large-scale dependency resolution.

### How Our Design Addresses These

| Concern | Our Approach |
| :-- | :-- |
| Spurious allocations in compare | Immutable Schema.TaggedClass; compare works on fields directly, no re-construction |
| Range re-parsing | Ranges are parsed once into immutable Range objects; VersionCache resolves against pre-parsed ranges |
| Sort overhead | `Order<SemVer>` instance works directly on SemVer instances; no string conversion |
| toString rebuilding | Can cache the string representation in the Schema.TaggedClass (computed once, immutable) |
| Satisfaction caching | VersionCache's `Ref<SortedSet>` enables efficient range resolution without repeated work |

### Additional Performance Considerations

- **Recursive descent parser** may be slightly slower than regex for simple
  versions, but produces far better errors. For hot paths, pre-parsed SemVer
  instances avoid the parser entirely.
- **SortedSet** backing for VersionCache gives O(log n) operations, which
  is optimal for the read-heavy access pattern.
- **Structural sharing** in SortedSet means cache updates are cheap.

---

## Recommendations

Based on this analysis, here are specific actions for our implementation.

### Must Have (Core Implementation)

1. **Comprehensive prerelease tests.** This is the biggest source of bugs in
   node-semver. Our test suite must cover:
   - Mixed numeric/alphanumeric identifier comparison
   - Leading zeros in numeric identifiers (reject strictly)
   - Prerelease matching in ranges (same-tuple rule)
   - Caret/tilde desugaring with prerelease versions
   - `inc()` behavior on existing prerelease versions
   - Edge case: empty prerelease array vs. no prerelease

2. **Rich parse errors with position.** Many node-semver users are frustrated
   by opaque "Invalid Version" errors. Our parser errors should include:
   - The input string
   - The character position where parsing failed
   - A human-readable description of what was expected
   - For ranges: which comparator in the range failed

3. **Strict v-prefix rejection.** Reject `v1.2.3`, `V1.2.3`, `v=1.2.3`, etc.
   This is a documented pain point (#376, #691) and a planned breaking change
   for node-semver v8. We should be strict from the start.

4. **Correct subset/intersect for prerelease ranges.** Issues #757 and #703
   show that range algebra with prereleases is broken in node-semver. Our
   `Range.isSubset` and `Range.intersect` must handle these correctly.

5. **Build metadata preservation.** Store build metadata in the data model,
   include it in `toString()`, but exclude it from `Equal` and `Order` per
   spec. Issue #264 shows this is a common source of confusion.

### Should Have (Phase 2)

1. **Document prerelease matching rules clearly.** Issue #721 shows that even
   after reading all documentation and tickets, users are confused. Our API
   docs should include worked examples of prerelease matching behavior.

2. **Range.isSubset correctness over completeness.** Start with a correct
   implementation that handles the known edge cases (#757, #703, #521), even
   if it's conservative (returns false for cases it can't prove).

3. **Version 0.x caret convention.** Follow node-semver's convention
   (`^0.1.2` means `>=0.1.2 <0.2.0`) and document it explicitly, since the
   SemVer spec is silent on this.

### Nice to Have (Phase 3)

1. **SemVer.truncate(level).** Strip prerelease/build from a version
   (#48). Simple utility with clear use cases.

2. **Optional build metadata comparison.** An opt-in function
    `SemVer.compareWithBuild` for CI use cases (#610) where build numbers
    matter.

3. **Range construction API.** Programmatic range building (#314) for
    tooling use cases. Lower priority but would differentiate us from
    node-semver's string-only range creation.

4. **Port node-semver's test fixtures.** node-semver has extensive
    test fixtures (`test/fixtures/range-include.js`, `range-exclude.js`,
    etc.) that encode years of edge-case discovery. We should port these
    as a compatibility baseline, adapting for our strict-mode differences.

### Explicitly Out of Scope

- **Loose mode / coercion:** We are strict SemVer 2.0.0 only. No loose
  parsing, no coercion, no `v` prefix tolerance.
- **CLI tool:** We are a library. CLI functionality is not planned.
- **Sync API wrapper:** Effect-native only for v1. Sync wrapper may come
  later based on demand.
- **Comma-separated constraints:** Not part of the SemVer spec or
  node-semver's syntax.

---

## Key Takeaways

1. **Prerelease handling is the #1 problem area.** At least 15 issues across
   open and closed relate to prerelease bugs, confusion, or missing features.
   Getting this right is our biggest opportunity for differentiation.

2. **null returns cause cascading failures.** Our Effect-based error model is
   a direct answer to the most common user frustration with node-semver.

3. **Immutability eliminates an entire class of bugs.** Clone requests,
   instanceof failures, spurious allocations -- all gone with immutable
   Schema.TaggedClass.

4. **Range algebra (subset, intersect) is both wanted and broken.** Users
   have requested these features for years, and the existing implementations
   have known bugs. This is a high-value area for our implementation.

5. **The semver@8 tracking issue is our roadmap.** The breaking changes
   planned for v8 (#501) validate many of our design decisions: strict
   prefix handling, error-throwing satisfies, ESM support, and better
   internal structure.
