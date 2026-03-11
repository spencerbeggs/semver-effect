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
