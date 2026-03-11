import { Data } from "effect";

/**
 * Tagged error base for {@link InvalidPrereleaseError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `InvalidPrereleaseError` appears in public type signatures.
 * Consumers should use {@link InvalidPrereleaseError} directly.
 *
 * @internal
 */
export const InvalidPrereleaseErrorBase = Data.TaggedError("InvalidPrereleaseError");

/**
 * Indicates that a prerelease identifier is not valid per SemVer 2.0.0.
 *
 * Prerelease identifiers must be non-empty and composed of alphanumerics and
 * hyphens. Numeric identifiers must not have leading zeros.
 *
 * @see {@link SemVer}
 * @see {@link https://semver.org/#spec-item-9 | SemVer 2.0.0 Section 9}
 */
export class InvalidPrereleaseError extends InvalidPrereleaseErrorBase<{
	/** The invalid prerelease identifier string. */
	readonly input: string;
}> {
	get message(): string {
		return `Invalid prerelease identifier: "${this.input}"`;
	}
}
