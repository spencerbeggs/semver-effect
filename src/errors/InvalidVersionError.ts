import { Data } from "effect";

/**
 * Tagged error base for {@link InvalidVersionError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `InvalidVersionError` appears in public type signatures.
 * Consumers should use {@link InvalidVersionError} directly.
 *
 * @internal
 */
export const InvalidVersionErrorBase = Data.TaggedError("InvalidVersionError");

/**
 * Indicates that a string could not be parsed as a valid SemVer 2.0.0 version.
 *
 * This error is returned when {@link parseVersion} (or the `SemVerParser` service)
 * encounters input that does not conform to the `major.minor.patch[-prerelease][+build]`
 * format. Unlike node-semver, no loose parsing or `v`-prefix coercion is performed.
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 */
export class InvalidVersionError extends InvalidVersionErrorBase<{
	/** The raw input string that failed to parse. */
	readonly input: string;
	/** The character position where parsing failed, if available. */
	readonly position?: number;
}> {
	get message(): string {
		const base = `Invalid version string: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}
