import { Equal, Function as Fn, Option } from "effect";
import { SemVer } from "../schemas/SemVer.js";
import { SemVerOrder, SemVerOrderWithBuild } from "./order.js";

/**
 * Compare two {@link SemVer} versions according to SemVer 2.0.0 precedence.
 *
 * Returns `-1` if `self` is lower, `0` if equal, `1` if higher. Build metadata
 * is ignored per the spec. Supports both data-last and data-first calling styles.
 *
 * @example
 * ```typescript
 * import { compare, parseVersion } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const a = yield* parseVersion("1.0.0");
 *   const b = yield* parseVersion("2.0.0");
 *   console.log(compare(a, b)); // -1
 * });
 * ```
 *
 * @see {@link SemVerOrder}
 * @see {@link https://semver.org/#spec-item-11 | SemVer 2.0.0 Section 11}
 */
export const compare: {
	(that: SemVer): (self: SemVer) => -1 | 0 | 1;
	(self: SemVer, that: SemVer): -1 | 0 | 1;
} = Fn.dual(2, (self: SemVer, that: SemVer): -1 | 0 | 1 => SemVerOrder(self, that));

/**
 * Test whether two {@link SemVer} versions are equal.
 *
 * Uses Effect structural equality ({@link Equal.equals}), which compares
 * `major.minor.patch` and prerelease identifiers but ignores build metadata.
 *
 * @see {@link neq}
 * @see {@link compare}
 */
export const equal: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => Equal.equals(self, that));

/**
 * Test whether `self` is strictly greater than `that`.
 *
 * @see {@link gte}
 * @see {@link compare}
 */
export const gt: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) === 1);

/**
 * Test whether `self` is greater than or equal to `that`.
 *
 * @see {@link gt}
 * @see {@link compare}
 */
export const gte: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) >= 0);

/**
 * Test whether `self` is strictly less than `that`.
 *
 * @see {@link lte}
 * @see {@link compare}
 */
export const lt: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) === -1);

/**
 * Test whether `self` is less than or equal to `that`.
 *
 * @see {@link lt}
 * @see {@link compare}
 */
export const lte: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) <= 0);

/**
 * Test whether two {@link SemVer} versions are not equal.
 *
 * @see {@link equal}
 */
export const neq: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => !Equal.equals(self, that));

/**
 * Test whether a version has prerelease identifiers.
 *
 * @see {@link isStable}
 */
export const isPrerelease = (v: SemVer): boolean => v.prerelease.length > 0;

/**
 * Test whether a version is a stable release (no prerelease identifiers).
 *
 * @see {@link isPrerelease}
 */
export const isStable = (v: SemVer): boolean => v.prerelease.length === 0;

/**
 * Strip prerelease and/or build metadata from a version.
 *
 * - `"prerelease"` removes both prerelease identifiers and build metadata.
 * - `"build"` removes only build metadata, preserving prerelease identifiers.
 *
 * Returns a new {@link SemVer} instance; the original is not mutated.
 *
 * @example
 * ```typescript
 * import { truncate, parseVersion } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* parseVersion("1.2.3-alpha.1+build");
 *   console.log(truncate(v, "prerelease").toString()); // "1.2.3"
 *   console.log(truncate(v, "build").toString());      // "1.2.3-alpha.1"
 * });
 * ```
 */
export const truncate: {
	(level: "prerelease" | "build"): (v: SemVer) => SemVer;
	(v: SemVer, level: "prerelease" | "build"): SemVer;
} = Fn.dual(
	2,
	(v: SemVer, level: "prerelease" | "build"): SemVer =>
		level === "prerelease"
			? new SemVer({ major: v.major, minor: v.minor, patch: v.patch, prerelease: [], build: [] })
			: new SemVer({
					major: v.major,
					minor: v.minor,
					patch: v.patch,
					prerelease: [...v.prerelease],
					build: [],
				}),
);

/**
 * Sort an array of {@link SemVer} versions in ascending order.
 *
 * Returns a new array; the input is not mutated.
 *
 * @see {@link rsort}
 * @see {@link SemVerOrder}
 */
export const sort = (versions: ReadonlyArray<SemVer>): Array<SemVer> => [...versions].sort(SemVerOrder);

/**
 * Sort an array of {@link SemVer} versions in descending order.
 *
 * Returns a new array; the input is not mutated.
 *
 * @see {@link sort}
 * @see {@link SemVerOrder}
 */
export const rsort = (versions: ReadonlyArray<SemVer>): Array<SemVer> =>
	[...versions].sort((a, b) => SemVerOrder(b, a));

/**
 * Find the highest version in an array.
 *
 * Returns `Option.none()` for an empty array.
 *
 * @see {@link min}
 * @see {@link sort}
 */
export const max = (versions: ReadonlyArray<SemVer>): Option.Option<SemVer> => {
	if (versions.length === 0) return Option.none();
	let result = versions[0];
	for (let i = 1; i < versions.length; i++) {
		if (SemVerOrder(versions[i], result) === 1) {
			result = versions[i];
		}
	}
	return Option.some(result);
};

/**
 * Find the lowest version in an array.
 *
 * Returns `Option.none()` for an empty array.
 *
 * @see {@link max}
 * @see {@link sort}
 */
export const min = (versions: ReadonlyArray<SemVer>): Option.Option<SemVer> => {
	if (versions.length === 0) return Option.none();
	let result = versions[0];
	for (let i = 1; i < versions.length; i++) {
		if (SemVerOrder(versions[i], result) === -1) {
			result = versions[i];
		}
	}
	return Option.some(result);
};

/**
 * Compare two versions including build metadata.
 *
 * This extends the standard {@link compare} by additionally comparing build
 * metadata lexicographically when versions are otherwise equal. Per SemVer 2.0.0,
 * build metadata SHOULD be ignored for precedence, but this function is provided
 * for cases where a total ordering including build metadata is needed.
 *
 * @see {@link compare}
 * @see {@link SemVerOrderWithBuild}
 */
export const compareWithBuild: {
	(that: SemVer): (self: SemVer) => -1 | 0 | 1;
	(self: SemVer, that: SemVer): -1 | 0 | 1;
} = Fn.dual(2, (self: SemVer, that: SemVer): -1 | 0 | 1 => SemVerOrderWithBuild(self, that));
