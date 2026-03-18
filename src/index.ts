/**
 * **semver-effect** — Strict SemVer 2.0.0 implementation built on Effect.
 *
 * @example
 * ```typescript
 * import { SemVer, Range, satisfies } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.2.3");
 *   const next = v.bump.minor();            // 1.3.0
 *   const range = yield* Range.parse("^1.0.0");
 *   console.log(range.test(v));             // true
 *   console.log(v.gt(next));                // false
 * });
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @see {@link https://effect.website | Effect}
 *
 * @packageDocumentation
 */

// Errors
export { EmptyCacheError, EmptyCacheErrorBase } from "./errors/EmptyCacheError.js";
export { InvalidBumpError, InvalidBumpErrorBase } from "./errors/InvalidBumpError.js";
export { InvalidComparatorError, InvalidComparatorErrorBase } from "./errors/InvalidComparatorError.js";
export { InvalidPrereleaseError, InvalidPrereleaseErrorBase } from "./errors/InvalidPrereleaseError.js";
export { InvalidRangeError, InvalidRangeErrorBase } from "./errors/InvalidRangeError.js";
export { InvalidVersionError, InvalidVersionErrorBase } from "./errors/InvalidVersionError.js";
export {
	UnsatisfiableConstraintError,
	UnsatisfiableConstraintErrorBase,
} from "./errors/UnsatisfiableConstraintError.js";
export { UnsatisfiedRangeError, UnsatisfiedRangeErrorBase } from "./errors/UnsatisfiedRangeError.js";
export { VersionFetchError, VersionFetchErrorBase } from "./errors/VersionFetchError.js";
export { VersionNotFoundError, VersionNotFoundErrorBase } from "./errors/VersionNotFoundError.js";
// Layers
export { SemVerParserLive } from "./layers/SemVerParserLive.js";
export { VersionCacheLive } from "./layers/VersionCacheLive.js";
export { Comparator } from "./schemas/Comparator.js";
export { type ComparatorSet, Range } from "./schemas/Range.js";
// Schemas
export { SemVer, SemVerBump } from "./schemas/SemVer.js";
export { VersionDiff } from "./schemas/VersionDiff.js";
// Services
export { SemVerParser } from "./services/SemVerParser.js";
export { VersionCache } from "./services/VersionCache.js";
export { VersionFetcher } from "./services/VersionFetcher.js";
// Algebra
export { equivalent, intersect, isSubset, simplify, union } from "./utils/algebra.js";
// Bump (standalone functions)
export { bumpMajor, bumpMinor, bumpPatch, bumpPrerelease, bumpRelease } from "./utils/bump.js";
// Comparison & predicates (standalone dual-API functions)
export {
	compare,
	compareWithBuild,
	equal,
	gt,
	gte,
	isPrerelease,
	isStable,
	lt,
	lte,
	max,
	min,
	neq,
	rsort,
	sort,
	truncate,
} from "./utils/compare.js";
// Diff
export { diff } from "./utils/diff.js";
// Parsing (standalone functions)
export { parseSingleComparator, parseValidSemVer } from "./utils/grammar.js";
// Matching (standalone dual-API functions)
export { filter, maxSatisfying, minSatisfying, satisfies } from "./utils/matching.js";
// Order
export { SemVerOrder, SemVerOrderWithBuild } from "./utils/order.js";
export { parseRange } from "./utils/parseRange.js";
// Pretty print
export { type Printable, prettyPrint } from "./utils/prettyPrint.js";

// ── Wire cross-cutting static methods (avoids circular imports) ─────────

import { Comparator } from "./schemas/Comparator.js";
import { Range } from "./schemas/Range.js";
import { SemVer } from "./schemas/SemVer.js";
import { compare, equal, gt, gte, lt, lte, max, min, neq, rsort, sort } from "./utils/compare.js";
import { diff } from "./utils/diff.js";
import { parseSingleComparator, parseValidSemVer } from "./utils/grammar.js";
import { filter, maxSatisfying, minSatisfying, satisfies } from "./utils/matching.js";
import { parseRange } from "./utils/parseRange.js";

// SemVer statics
SemVer.parse = parseValidSemVer;
SemVer.of = (major, minor, patch, prerelease = [], build = []) =>
	new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });
SemVer.compare = compare;
SemVer.equal = equal;
SemVer.gt = gt;
SemVer.gte = gte;
SemVer.lt = lt;
SemVer.lte = lte;
SemVer.neq = neq;
SemVer.diff = diff;
SemVer.sort = sort;
SemVer.rsort = rsort;
SemVer.max = max;
SemVer.min = min;

// Comparator statics
Comparator.parse = parseSingleComparator;

// Range statics
Range.parse = parseRange;
Range.satisfies = satisfies;
Range.filter = filter;
Range.maxSatisfying = maxSatisfying;
Range.minSatisfying = minSatisfying;
