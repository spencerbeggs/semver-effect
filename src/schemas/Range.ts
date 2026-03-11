import { Data } from "effect";
import type { Comparator } from "./Comparator.js";

/**
 * A comparator set: an array of {@link Comparator} instances combined with AND
 * semantics. A version must satisfy every comparator in the set to match.
 *
 * @see {@link Range}
 */
export type ComparatorSet = ReadonlyArray<Comparator>;

/** @internal */
export const RangeBase = Data.TaggedClass("Range");

/**
 * A SemVer range expression, represented as a union (OR) of {@link ComparatorSet}s.
 *
 * A version satisfies a range if it satisfies at least one of the comparator sets.
 * Each comparator set is an intersection (AND) of individual {@link Comparator}s.
 *
 * Range syntax follows node-semver conventions (hyphen ranges, X-ranges, tilde
 * ranges, caret ranges) but enforcement is strict SemVer 2.0.0 only.
 *
 * @example
 * ```typescript
 * import { parseRange } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const range = yield* parseRange(">=1.0.0 <2.0.0 || ^3.0.0");
 *   console.log(range.toString()); // ">=1.0.0 <2.0.0 || >=3.0.0 <4.0.0"
 * });
 * ```
 *
 * @see {@link Comparator}
 * @see {@link ComparatorSet}
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 */
export class Range extends RangeBase<{
	readonly sets: ReadonlyArray<ReadonlyArray<Comparator>>;
}> {
	toString(): string {
		return this.sets.map((set) => set.map((c) => c.toString()).join(" ")).join(" || ");
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
