import { Order } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

const comparePrereleaseIdentifier = (a: string | number, b: string | number): number => {
	// Both numbers: compare as integers
	if (typeof a === "number" && typeof b === "number") return a - b;
	// Both strings: compare lexicographically
	if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
	// Numeric < alphanumeric
	if (typeof a === "number") return -1;
	return 1;
};

/**
 * Effect {@link Order.Order} instance for {@link SemVer} following SemVer 2.0.0
 * precedence rules.
 *
 * Compares `major.minor.patch` numerically, then prerelease identifiers per
 * the spec (numeric identifiers compared as integers, string identifiers
 * compared lexicographically, numeric always lower than string). Build metadata
 * is ignored.
 *
 * @remarks
 * Prerelease comparison follows the SemVer 2.0.0 specification strictly:
 * - A version with prerelease has lower precedence than the same version without.
 * - Identifiers are compared left-to-right; numeric precedes alphanumeric.
 * - A shorter set of identifiers has lower precedence than a longer one when all
 *   preceding identifiers are equal.
 *
 * @see {@link SemVerOrderWithBuild}
 * @see {@link compare}
 * @see {@link https://semver.org/#spec-item-11 | SemVer 2.0.0 Section 11}
 */
export const SemVerOrder: Order.Order<SemVer> = Order.make((a, b) => {
	// 1. Compare major.minor.patch
	if (a.major !== b.major) return a.major < b.major ? -1 : 1;
	if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
	if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

	// 2. No prerelease > has prerelease
	const aHasPre = a.prerelease.length > 0;
	const bHasPre = b.prerelease.length > 0;
	if (!aHasPre && bHasPre) return 1;
	if (aHasPre && !bHasPre) return -1;

	// 3. Compare prerelease identifiers
	const len = Math.min(a.prerelease.length, b.prerelease.length);
	for (let i = 0; i < len; i++) {
		const cmp = comparePrereleaseIdentifier(a.prerelease[i], b.prerelease[i]);
		if (cmp !== 0) return cmp < 0 ? -1 : 1;
	}

	// 4. Shorter prerelease < longer
	if (a.prerelease.length !== b.prerelease.length) {
		return a.prerelease.length < b.prerelease.length ? -1 : 1;
	}

	return 0;
});

/**
 * Effect {@link Order.Order} instance for {@link SemVer} that additionally
 * compares build metadata when versions are otherwise equal.
 *
 * Per SemVer 2.0.0, build metadata SHOULD be ignored for precedence. This
 * order is provided for cases where a total ordering including build metadata
 * is needed (e.g., deduplication). Build identifiers are compared
 * lexicographically; a version with no build metadata sorts before one with it.
 *
 * @see {@link SemVerOrder}
 * @see {@link compareWithBuild}
 */
export const SemVerOrderWithBuild: Order.Order<SemVer> = Order.make((a, b) => {
	const base = SemVerOrder(a, b);
	if (base !== 0) return base;

	// No build < has build
	const aHasBuild = a.build.length > 0;
	const bHasBuild = b.build.length > 0;
	if (!aHasBuild && bHasBuild) return -1;
	if (aHasBuild && !bHasBuild) return 1;

	// Compare build identifiers lexicographically
	const len = Math.min(a.build.length, b.build.length);
	for (let i = 0; i < len; i++) {
		if (a.build[i] < b.build[i]) return -1;
		if (a.build[i] > b.build[i]) return 1;
	}

	if (a.build.length !== b.build.length) {
		return a.build.length < b.build.length ? -1 : 1;
	}

	return 0;
});
