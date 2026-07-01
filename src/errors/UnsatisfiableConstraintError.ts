import { Data } from "effect";
import type { Range } from "../schemas/Range.js";

/**
 * Tagged error base for {@link UnsatisfiableConstraintError}.
 *
 * @privateRemarks
 * Marked `@public` (rather than `@internal`) because `UnsatisfiableConstraintError`
 * extends it directly: API Extractor requires a class's release tag to be at least
 * as public as every type in its `extends` clause. Consumers should use
 * {@link UnsatisfiableConstraintError} directly rather than referencing this base.
 *
 * @public
 */
export const UnsatisfiableConstraintErrorBase = Data.TaggedError("UnsatisfiableConstraintError");

/**
 * Indicates that the intersection of two or more {@link Range}s produces an
 * empty (unsatisfiable) result.
 *
 * Returned by {@link intersect} when no comparator set in the cross-product
 * of the input ranges is satisfiable.
 *
 * @see {@link intersect}
 * @see {@link Range}
 * @public
 */
export class UnsatisfiableConstraintError extends UnsatisfiableConstraintErrorBase<{
	/** The ranges that were being intersected. */
	readonly constraints: ReadonlyArray<Range>;
}> {
	get message(): string {
		const count = this.constraints.length;
		return `No version satisfies all ${count} constraint${count === 1 ? "" : "s"}`;
	}
}
