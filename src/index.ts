/**
 * **semver-effect** -- Strict SemVer 2.0.0 implementation built on Effect.
 *
 * Provides typed parsing, range algebra, version comparison, bump utilities,
 * and an in-memory version cache service.
 *
 * ## Key divergences from node-semver
 *
 * - Only SemVer 2.0.0 is supported (no loose parsing, no `v`-prefix coercion).
 * - All effectful operations return `Effect` types, not plain values.
 * - Prerelease comparison follows the spec strictly (no coercion).
 * - Build metadata is preserved but ignored in comparisons per the spec.
 * - Range syntax follows node-semver conventions but enforcement is strict.
 *
 * ## Quick start
 *
 * ```typescript
 * import { parseVersion, parseRange, satisfies, compare, bumpMinor } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* parseVersion("1.2.3");
 *   const range = yield* parseRange("^1.0.0");
 *   console.log(satisfies(v, range)); // true
 *   console.log(compare(v, yield* parseVersion("2.0.0"))); // -1
 *   console.log(bumpMinor(v).toString()); // "1.3.0"
 * });
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @see {@link https://effect.website | Effect}
 *
 * @packageDocumentation
 */

// Errors
export {
	EmptyCacheError,
	EmptyCacheErrorBase,
} from "./errors/EmptyCacheError.js";
export {
	InvalidBumpError,
	InvalidBumpErrorBase,
} from "./errors/InvalidBumpError.js";
export {
	InvalidComparatorError,
	InvalidComparatorErrorBase,
} from "./errors/InvalidComparatorError.js";
export {
	InvalidPrereleaseError,
	InvalidPrereleaseErrorBase,
} from "./errors/InvalidPrereleaseError.js";
export {
	InvalidRangeError,
	InvalidRangeErrorBase,
} from "./errors/InvalidRangeError.js";
export {
	InvalidVersionError,
	InvalidVersionErrorBase,
} from "./errors/InvalidVersionError.js";
export {
	UnsatisfiableConstraintError,
	UnsatisfiableConstraintErrorBase,
} from "./errors/UnsatisfiableConstraintError.js";
export {
	UnsatisfiedRangeError,
	UnsatisfiedRangeErrorBase,
} from "./errors/UnsatisfiedRangeError.js";
export {
	VersionFetchError,
	VersionFetchErrorBase,
} from "./errors/VersionFetchError.js";
export {
	VersionNotFoundError,
	VersionNotFoundErrorBase,
} from "./errors/VersionNotFoundError.js";
// Layers
export { SemVerParserLive } from "./layers/SemVerParserLive.js";
export { VersionCacheLive } from "./layers/VersionCacheLive.js";
// Schemas
export { Comparator } from "./schemas/Comparator.js";
export type { ComparatorSet } from "./schemas/Range.js";
export { Range } from "./schemas/Range.js";
export { SemVer } from "./schemas/SemVer.js";
export { VersionDiff } from "./schemas/VersionDiff.js";
// Services
export { SemVerParser } from "./services/SemVerParser.js";
export { VersionCache } from "./services/VersionCache.js";
export { VersionFetcher } from "./services/VersionFetcher.js";
// Algebra
export { equivalent, intersect, isSubset, simplify, union } from "./utils/algebra.js";
// Bump
export { bumpMajor, bumpMinor, bumpPatch, bumpPrerelease, bumpRelease } from "./utils/bump.js";
// Comparison
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
// Convenience parsing functions
export { parseSingleComparator as parseComparator, parseValidSemVer as parseVersion } from "./utils/grammar.js";
// Matching
export { filter, maxSatisfying, minSatisfying, satisfies } from "./utils/matching.js";
// Order
export { SemVerOrder, SemVerOrderWithBuild } from "./utils/order.js";
// Parse range
export { parseRange } from "./utils/parseRange.js";
// Pretty print
export type { Printable } from "./utils/prettyPrint.js";
export { prettyPrint } from "./utils/prettyPrint.js";
