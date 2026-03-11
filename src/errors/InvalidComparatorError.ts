import { Data } from "effect";

/**
 * Tagged error base for {@link InvalidComparatorError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `InvalidComparatorError` appears in public type signatures.
 * Consumers should use {@link InvalidComparatorError} directly.
 *
 * @internal
 */
export const InvalidComparatorErrorBase = Data.TaggedError("InvalidComparatorError");

/**
 * Indicates that a string could not be parsed as a valid single {@link Comparator}.
 *
 * Returned by {@link parseComparator} (and `SemVerParser.parseComparator`) when the
 * input is not a valid `[operator]major.minor.patch[-prerelease][+build]` string.
 * Wildcards and range syntax are not allowed in single comparator parsing.
 *
 * @see {@link Comparator}
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
