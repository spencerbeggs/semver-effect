import { Data } from "effect";

/**
 * Tagged error base for {@link InvalidRangeError}.
 *
 * @privateRemarks
 * Marked `@public` (rather than `@internal`) because `InvalidRangeError` extends it
 * directly: API Extractor requires a class's release tag to be at least as public
 * as every type in its `extends` clause. Consumers should use {@link InvalidRangeError}
 * directly rather than referencing this base.
 *
 * @public
 */
export const InvalidRangeErrorBase = Data.TaggedError("InvalidRangeError");

/**
 * Indicates that a string could not be parsed as a valid SemVer range expression.
 *
 * Returned by {@link parseRange} and the `SemVerParser.parseRange` service method
 * when the input is not a valid range. Supported syntax includes hyphen ranges,
 * X-ranges, tilde ranges, caret ranges, and `||`-separated unions, but all
 * version components must be strictly valid SemVer 2.0.0.
 *
 * @see {@link Range}
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @public
 */
export class InvalidRangeError extends InvalidRangeErrorBase<{
	/** The raw input string that failed to parse. */
	readonly input: string;
	/** The character position where parsing failed, if available. */
	readonly position?: number;
}> {
	get message(): string {
		const base = `Invalid range expression: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}
