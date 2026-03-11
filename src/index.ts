/**
 * semver-effect
 *
 * Strict SemVer 2.0.0 implementation built on Effect, providing typed
 * parsing, range algebra, and version cache services.
 *
 * @packageDocumentation
 */

// Errors
export {
	EmptyCacheError,
	/** @internal */
	EmptyCacheErrorBase,
} from "./errors/EmptyCacheError.js";
export {
	InvalidBumpError,
	/** @internal */
	InvalidBumpErrorBase,
} from "./errors/InvalidBumpError.js";
export {
	InvalidComparatorError,
	/** @internal */
	InvalidComparatorErrorBase,
} from "./errors/InvalidComparatorError.js";
export {
	InvalidPrereleaseError,
	/** @internal */
	InvalidPrereleaseErrorBase,
} from "./errors/InvalidPrereleaseError.js";
export {
	InvalidRangeError,
	/** @internal */
	InvalidRangeErrorBase,
} from "./errors/InvalidRangeError.js";
export {
	InvalidVersionError,
	/** @internal */
	InvalidVersionErrorBase,
} from "./errors/InvalidVersionError.js";
export {
	UnsatisfiableConstraintError,
	/** @internal */
	UnsatisfiableConstraintErrorBase,
} from "./errors/UnsatisfiableConstraintError.js";
export {
	UnsatisfiedRangeError,
	/** @internal */
	UnsatisfiedRangeErrorBase,
} from "./errors/UnsatisfiedRangeError.js";
export {
	VersionFetchError,
	/** @internal */
	VersionFetchErrorBase,
} from "./errors/VersionFetchError.js";
export {
	VersionNotFoundError,
	/** @internal */
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
