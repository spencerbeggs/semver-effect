/**
 * semver-effect
 *
 * Strict SemVer 2.0.0 implementation built on Effect, providing typed
 * parsing, range algebra, and version cache services.
 *
 * @packageDocumentation
 */

// Errors
export { EmptyCacheError } from "./errors/EmptyCacheError.js";
export { InvalidBumpError } from "./errors/InvalidBumpError.js";
export { InvalidComparatorError } from "./errors/InvalidComparatorError.js";
export { InvalidPrereleaseError } from "./errors/InvalidPrereleaseError.js";
export { InvalidRangeError } from "./errors/InvalidRangeError.js";
export { InvalidVersionError } from "./errors/InvalidVersionError.js";
export { UnsatisfiableConstraintError } from "./errors/UnsatisfiableConstraintError.js";
export { UnsatisfiedRangeError } from "./errors/UnsatisfiedRangeError.js";
export { VersionFetchError } from "./errors/VersionFetchError.js";
export { VersionNotFoundError } from "./errors/VersionNotFoundError.js";
// Layers
export { SemVerParserLive } from "./layers/SemVerParserLive.js";
// Order
export { SemVerOrder, SemVerOrderWithBuild } from "./order.js";
// Schemas
export { Comparator } from "./schemas/Comparator.js";
export type { ComparatorSet } from "./schemas/Range.js";
export { Range } from "./schemas/Range.js";
export { SemVer } from "./schemas/SemVer.js";
export { VersionDiff } from "./schemas/VersionDiff.js";
// Services
export { SemVerParser } from "./services/SemVerParser.js";
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
export { parseRange } from "./utils/parseRange.js";
