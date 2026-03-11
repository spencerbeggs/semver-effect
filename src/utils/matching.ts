import { Function as Fn, Option } from "effect";
import type { Comparator } from "../schemas/Comparator.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";
import { SemVerOrder } from "./order.js";

const satisfiesComparator = (version: SemVer, comp: Comparator): boolean => {
	const cmp = SemVerOrder(version, comp.version);
	switch (comp.operator) {
		case "=":
			return cmp === 0;
		case ">":
			return cmp > 0;
		case ">=":
			return cmp >= 0;
		case "<":
			return cmp < 0;
		case "<=":
			return cmp <= 0;
	}
};

const satisfiesComparatorSet = (version: SemVer, set: ReadonlyArray<Comparator>): boolean => {
	// Empty set matches all
	if (set.length === 0) return true;

	// Prerelease tuple restriction:
	// If version has prerelease, at least one comparator in the set must
	// have prerelease AND share the same [major, minor, patch] tuple.
	if (version.prerelease.length > 0) {
		const hasTupleMatch = set.some(
			(c) =>
				c.version.prerelease.length > 0 &&
				c.version.major === version.major &&
				c.version.minor === version.minor &&
				c.version.patch === version.patch,
		);
		if (!hasTupleMatch) return false;
	}

	// All comparators must be satisfied (AND semantics)
	return set.every((c) => satisfiesComparator(version, c));
};

/**
 * Test whether a {@link SemVer} version satisfies a {@link Range}.
 *
 * A version satisfies a range if it matches at least one of the range's
 * comparator sets (OR semantics). Within a comparator set, all comparators
 * must be satisfied (AND semantics).
 *
 * Prerelease versions are subject to the "tuple restriction": a prerelease
 * version only matches a comparator set if at least one comparator in that set
 * also has a prerelease tag on the same `major.minor.patch` tuple. This follows
 * the node-semver convention for prerelease handling.
 *
 * @example
 * ```typescript
 * import { satisfies, parseVersion, parseRange } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* parseVersion("1.5.0");
 *   const r = yield* parseRange("^1.0.0");
 *   console.log(satisfies(v, r)); // true
 * });
 * ```
 *
 * @see {@link filter}
 * @see {@link maxSatisfying}
 * @see {@link minSatisfying}
 */
export const satisfies: {
	(range: Range): (version: SemVer) => boolean;
	(version: SemVer, range: Range): boolean;
} = Fn.dual(2, (version: SemVer, range: Range): boolean =>
	range.sets.some((set) => satisfiesComparatorSet(version, set)),
);

/**
 * Filter an array of {@link SemVer} versions to only those satisfying a {@link Range}.
 *
 * @see {@link satisfies}
 * @see {@link maxSatisfying}
 * @see {@link minSatisfying}
 */
export const filter: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => Array<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): Array<SemVer>;
} = Fn.dual(
	2,
	(versions: ReadonlyArray<SemVer>, range: Range): Array<SemVer> => versions.filter((v) => satisfies(v, range)),
);

/**
 * Find the highest {@link SemVer} version satisfying a {@link Range}.
 *
 * Returns `Option.none()` if no version satisfies the range.
 *
 * @see {@link minSatisfying}
 * @see {@link satisfies}
 */
export const maxSatisfying: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => Option.Option<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer>;
} = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer> => {
	let best: SemVer | null = null;
	for (const v of versions) {
		if (satisfies(v, range)) {
			if (best === null || SemVerOrder(v, best) > 0) best = v;
		}
	}
	return best === null ? Option.none() : Option.some(best);
});

/**
 * Find the lowest {@link SemVer} version satisfying a {@link Range}.
 *
 * Returns `Option.none()` if no version satisfies the range.
 *
 * @see {@link maxSatisfying}
 * @see {@link satisfies}
 */
export const minSatisfying: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => Option.Option<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer>;
} = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer> => {
	let best: SemVer | null = null;
	for (const v of versions) {
		if (satisfies(v, range)) {
			if (best === null || SemVerOrder(v, best) < 0) best = v;
		}
	}
	return best === null ? Option.none() : Option.some(best);
});
