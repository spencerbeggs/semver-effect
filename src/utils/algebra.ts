import { Effect, Function as Fn } from "effect";
import { UnsatisfiableConstraintError } from "../errors/UnsatisfiableConstraintError.js";
import type { Comparator } from "../schemas/Comparator.js";
import { Range } from "../schemas/Range.js";
import { SemVerOrder } from "./order.js";

const makeRange = (sets: ReadonlyArray<ReadonlyArray<Comparator>>): Range =>
	new Range({ sets: sets.map((s) => [...s]) });

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

/**
 * Combine two {@link Range}s with OR semantics (union of comparator sets).
 *
 * The resulting range matches any version that satisfies either input range.
 * Internally, this concatenates the comparator sets from both ranges.
 *
 * @example
 * ```typescript
 * import { Range } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const a = yield* Range.fromString("^1.0.0");
 *   const b = yield* Range.fromString("^2.0.0");
 *   const combined = Range.union(a, b);
 *   // combined matches versions satisfying ^1.0.0 OR ^2.0.0
 * });
 * ```
 *
 * @see {@link intersect}
 * @see {@link equivalent}
 */
export const union: {
	(b: Range): (a: Range) => Range;
	(a: Range, b: Range): Range;
} = Fn.dual(2, (a: Range, b: Range): Range => makeRange([...a.sets, ...b.sets]));

/**
 * Compute the intersection of two {@link Range}s using a cross-product of
 * their comparator sets.
 *
 * The resulting range matches only versions that satisfy both input ranges.
 * Returns an {@link Effect.Effect} that fails with
 * {@link UnsatisfiableConstraintError} when no satisfiable comparator set
 * remains after intersection.
 *
 * @example
 * ```typescript
 * import { Range } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const a = yield* Range.fromString(">=1.0.0");
 *   const b = yield* Range.fromString("<2.0.0");
 *   const both = yield* Range.intersect(a, b);
 *   // both matches >=1.0.0 AND <2.0.0
 * });
 * ```
 *
 * @see {@link union}
 * @see {@link UnsatisfiableConstraintError}
 */
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

/**
 * Check whether every version matched by `sub` is also matched by `sup`.
 *
 * Returns `true` if the `sub` range is a subset of (i.e., fully contained by)
 * the `sup` range. This is determined by checking that every comparator set in
 * `sub` is implied by at least one comparator set in `sup`.
 *
 * @remarks
 * This check is a conservative approximation: it may return `false` for ranges
 * that are technically subsets when the sub-range straddles comparator-set
 * boundaries in the sup-range. For example, `>=1.0.0 <3.0.0` is a subset of
 * `>=1.0.0 <2.0.0 || >=2.0.0 <3.0.0`, but `isSubset` returns `false` because
 * no single sup-set fully implies the sub-set. This is a known limitation;
 * false negatives are safe (they prevent incorrect simplification).
 *
 * @see {@link equivalent}
 * @see {@link intersect}
 */
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

/**
 * Test whether two {@link Range}s are semantically equivalent.
 *
 * Two ranges are equivalent when each is a {@link isSubset | subset} of the other,
 * meaning they match exactly the same set of versions.
 *
 * @see {@link isSubset}
 */
export const equivalent: {
	(b: Range): (a: Range) => boolean;
	(a: Range, b: Range): boolean;
} = Fn.dual(2, (a: Range, b: Range): boolean => isSubset(a, b) && isSubset(b, a));

/**
 * Remove redundant comparator sets from a {@link Range}.
 *
 * A comparator set is considered redundant if another set in the range is a
 * subset of it (i.e., the other set is more restrictive and already covered).
 * Returns a new range with only the non-redundant sets.
 *
 * @see {@link isSubset}
 * @see {@link equivalent}
 */
export const simplify = (range: Range): Range => {
	const sets = range.sets.filter((set, i) => {
		return !range.sets.some((other, j) => i !== j && isComparatorSetSubset(set, other));
	});

	if (sets.length === 0) return range;
	return makeRange(sets);
};
