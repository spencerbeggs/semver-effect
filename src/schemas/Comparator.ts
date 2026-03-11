import { Data } from "effect";
import type { SemVer } from "./SemVer.js";

/** @internal */
export const ComparatorBase = Data.TaggedClass("Comparator");

/**
 * A single version constraint consisting of a comparison operator and a version.
 *
 * A comparator matches versions according to its operator:
 * - `"="` — exact match (displayed as bare version in {@link Comparator.toString})
 * - `">"` — strictly greater than
 * - `">="` — greater than or equal
 * - `"<"` — strictly less than
 * - `"<="` — less than or equal
 *
 * Comparators are the building blocks of {@link Range} objects: a comparator set
 * is an array of comparators combined with AND semantics, and a range is a union
 * (OR) of comparator sets.
 *
 * @example
 * ```typescript
 * import { parseComparator } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const comp = yield* parseComparator(">=1.2.3");
 *   console.log(comp.operator); // ">="
 *   console.log(comp.version.toString()); // "1.2.3"
 *   console.log(comp.toString()); // ">=1.2.3"
 * });
 * ```
 *
 * @see {@link Range}
 * @see {@link SemVer}
 */
export class Comparator extends ComparatorBase<{
	readonly operator: "=" | ">" | ">=" | "<" | "<=";
	readonly version: SemVer;
}> {
	toString(): string {
		const op = this.operator === "=" ? "" : this.operator;
		return `${op}${this.version.toString()}`;
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
