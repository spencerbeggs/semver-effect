import type { Comparator } from "../schemas/Comparator.js";
import { Range } from "../schemas/Range.js";
import { SemVerOrder } from "./order.js";

const operatorWeight = (op: string): number => {
	switch (op) {
		case ">=":
			return 0;
		case ">":
			return 1;
		case "=":
			return 2;
		case "<":
			return 3;
		case "<=":
			return 4;
		default:
			return 5;
	}
};

const sortComparators = (set: ReadonlyArray<Comparator>): ReadonlyArray<Comparator> =>
	[...set].sort((a, b) => {
		const w = operatorWeight(a.operator) - operatorWeight(b.operator);
		if (w !== 0) return w;
		return SemVerOrder(a.version, b.version);
	});

const removeDuplicates = (set: ReadonlyArray<Comparator>): ReadonlyArray<Comparator> => {
	const seen = new Set<string>();
	return set.filter((c) => {
		const key = `${c.operator}${c.version.toString()}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const normalizeComparatorSet = (set: ReadonlyArray<Comparator>): ReadonlyArray<Comparator> =>
	sortComparators(removeDuplicates(set));

export const normalizeRange = (range: Range): Range =>
	new Range({ sets: range.sets.map((set) => [...normalizeComparatorSet(set)]) });
