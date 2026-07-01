import { Data } from "effect";

/**
 * Tagged error base for {@link InvalidComparatorError}.
 *
 * @privateRemarks
 * Marked `@public` (rather than `@internal`) because `InvalidComparatorError` extends
 * it directly: API Extractor requires a class's release tag to be at least as public
 * as every type in its `extends` clause. Consumers should use
 * {@link InvalidComparatorError} directly rather than referencing this base.
 *
 * @public
 */
export const InvalidComparatorErrorBase = Data.TaggedError("InvalidComparatorError");

/**
 * Indicates that a string could not be parsed as a valid single {@link Comparator}.
 *
 * Returned by {@link parseSingleComparator} (and `SemVerParser.parseComparator`) when the
 * input is not a valid `[operator]major.minor.patch[-prerelease][+build]` string.
 * Wildcards and range syntax are not allowed in single comparator parsing.
 *
 * @see {@link Comparator}
 * @public
 */
export class InvalidComparatorError extends InvalidComparatorErrorBase<{
	/** The raw input string that failed to parse. */
	readonly input: string;
	/** The character position where parsing failed, if available. */
	readonly position?: number;
}> {
	get message(): string {
		const base = `Invalid comparator: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}
