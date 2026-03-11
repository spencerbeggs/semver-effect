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

export const satisfies: {
	(range: Range): (version: SemVer) => boolean;
	(version: SemVer, range: Range): boolean;
} = Fn.dual(2, (version: SemVer, range: Range): boolean =>
	range.sets.some((set) => satisfiesComparatorSet(version, set)),
);

export const filter: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => Array<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): Array<SemVer>;
} = Fn.dual(
	2,
	(versions: ReadonlyArray<SemVer>, range: Range): Array<SemVer> => versions.filter((v) => satisfies(v, range)),
);

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
