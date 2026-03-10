import { Effect, Function as Fn } from "effect";
import { UnsatisfiableConstraintError } from "../errors/UnsatisfiableConstraintError.js";
import { SemVerOrder } from "../order.js";
import type { Comparator } from "../schemas/Comparator.js";
import { Range } from "../schemas/Range.js";

const makeRange = (sets: ReadonlyArray<ReadonlyArray<Comparator>>): Range =>
	new Range({ sets: sets.map((s) => [...s]) }, { disableValidation: true });

const isSetSatisfiable = (set: ReadonlyArray<Comparator>): boolean => {
	const lowers: Array<Comparator> = [];
	const uppers: Array<Comparator> = [];
	const equals: Array<Comparator> = [];

	for (const c of set) {
		if (c.operator === "=") equals.push(c);
		else if (c.operator === ">" || c.operator === ">=") lowers.push(c);
		else uppers.push(c);
	}

	for (const eq of equals) {
		for (const c of set) {
			if (c === eq) continue;
			const cmp = SemVerOrder(eq.version, c.version);
			switch (c.operator) {
				case ">":
					if (cmp <= 0) return false;
					break;
				case ">=":
					if (cmp < 0) return false;
					break;
				case "<":
					if (cmp >= 0) return false;
					break;
				case "<=":
					if (cmp > 0) return false;
					break;
				case "=":
					if (cmp !== 0) return false;
					break;
			}
		}
	}

	for (const lo of lowers) {
		for (const hi of uppers) {
			const cmp = SemVerOrder(lo.version, hi.version);
			if (lo.operator === ">=" && hi.operator === "<") {
				if (cmp >= 0) return false;
			} else if (lo.operator === ">=" && hi.operator === "<=") {
				if (cmp > 0) return false;
			} else if (lo.operator === ">" && hi.operator === "<") {
				if (cmp >= 0) return false;
			} else if (lo.operator === ">" && hi.operator === "<=") {
				if (cmp >= 0) return false;
			}
		}
	}

	return true;
};

/** Combine two ranges with OR semantics (union of comparator sets). */
export const union: {
	(b: Range): (a: Range) => Range;
	(a: Range, b: Range): Range;
} = Fn.dual(2, (a: Range, b: Range): Range => makeRange([...a.sets, ...b.sets]));

/** Cross-product intersection of two ranges; fails when no satisfiable set remains. */
export const intersect: {
	(b: Range): (a: Range) => Effect.Effect<Range, UnsatisfiableConstraintError>;
	(a: Range, b: Range): Effect.Effect<Range, UnsatisfiableConstraintError>;
} = Fn.dual(2, (a: Range, b: Range): Effect.Effect<Range, UnsatisfiableConstraintError> => {
	const candidates: Array<Array<Comparator>> = [];

	for (const setA of a.sets) {
		for (const setB of b.sets) {
			const merged = [...setA, ...setB];
			if (isSetSatisfiable(merged)) {
				candidates.push(merged);
			}
		}
	}

	if (candidates.length === 0) {
		return Effect.fail(
			new UnsatisfiableConstraintError({
				constraints: [a, b],
			}),
		);
	}

	return Effect.succeed(makeRange(candidates));
});

const isComparatorImplied = (set: ReadonlyArray<Comparator>, comp: Comparator): boolean => {
	for (const s of set) {
		const cmp = SemVerOrder(s.version, comp.version);
		switch (comp.operator) {
			case ">=":
				if ((s.operator === ">=" && cmp >= 0) || (s.operator === ">" && cmp >= 0)) return true;
				if (s.operator === "=" && cmp >= 0) return true;
				break;
			case ">":
				if (s.operator === ">" && cmp >= 0) return true;
				if (s.operator === ">=" && cmp > 0) return true;
				if (s.operator === "=" && cmp > 0) return true;
				break;
			case "<=":
				if ((s.operator === "<=" && cmp <= 0) || (s.operator === "<" && cmp <= 0)) return true;
				if (s.operator === "=" && cmp <= 0) return true;
				break;
			case "<":
				if (s.operator === "<" && cmp <= 0) return true;
				if (s.operator === "<=" && cmp < 0) return true;
				if (s.operator === "=" && cmp < 0) return true;
				break;
			case "=":
				if (s.operator === "=" && cmp === 0) return true;
				break;
		}
	}
	return false;
};

const isComparatorSetSubset = (sub: ReadonlyArray<Comparator>, sup: ReadonlyArray<Comparator>): boolean => {
	for (const supComp of sup) {
		if (!isComparatorImplied(sub, supComp)) return false;
	}
	return true;
};

/** Check whether every version matched by `sub` is also matched by `sup`. */
export const isSubset: {
	(sup: Range): (sub: Range) => boolean;
	(sub: Range, sup: Range): boolean;
} = Fn.dual(2, (sub: Range, sup: Range): boolean => {
	for (const subSet of sub.sets) {
		const contained = sup.sets.some((supSet) => isComparatorSetSubset(subSet, supSet));
		if (!contained) return false;
	}
	return true;
});

/** Two ranges are equivalent when each is a subset of the other. */
export const equivalent: {
	(b: Range): (a: Range) => boolean;
	(a: Range, b: Range): boolean;
} = Fn.dual(2, (a: Range, b: Range): boolean => isSubset(a, b) && isSubset(b, a));

/** Remove redundant comparator sets from a range. */
export const simplify = (range: Range): Range => {
	const sets = range.sets.filter((set, i) => {
		return !range.sets.some((other, j) => i !== j && isComparatorSetSubset(other, set));
	});

	if (sets.length === 0) return range;
	return makeRange(sets);
};
