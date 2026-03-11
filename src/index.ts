/**
 * **semver-effect** — Strict SemVer 2.0.0 implementation built on Effect.
 *
 * Effect-idiomatic API: operations are namespaced under their primary type.
 *
 * ## Quick start
 *
 * ```typescript
 * import { SemVer, Range } from "semver-effect";
 * import { Effect, pipe } from "effect";
 *
 * const v = SemVer.make(1, 2, 3);
 * const next = SemVer.bump.minor(v);            // 1.3.0
 * pipe(v, SemVer.gt(SemVer.make(0, 9, 0)));     // true
 *
 * const program = Effect.gen(function* () {
 *   const parsed = yield* SemVer.fromString("2.0.0-rc.1");
 *   const range = yield* Range.fromString("^2.0.0");
 *   return Range.satisfies(parsed, range);       // true
 * });
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @see {@link https://effect.website | Effect}
 *
 * @packageDocumentation
 */

export * as Comparator from "./Comparator.js";
// ── Errors ──────────────────────────────────────────────────────────
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
// ── Layers ──────────────────────────────────────────────────────────
export { SemVerParserLive } from "./layers/SemVerParserLive.js";
export { VersionCacheLive } from "./layers/VersionCacheLive.js";
export * as PrettyPrint from "./PrettyPrint.js";
export * as Range from "./Range.js";
// ── Namespaced modules ──────────────────────────────────────────────
export * as SemVer from "./SemVer.js";
// ── Services ────────────────────────────────────────────────────────
export { SemVerParser } from "./services/SemVerParser.js";
export { VersionCache } from "./services/VersionCache.js";
export { VersionFetcher } from "./services/VersionFetcher.js";
export * as VersionDiff from "./VersionDiff.js";
