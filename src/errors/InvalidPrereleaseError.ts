import { Data } from "effect";

/**
 * Tagged error base for {@link InvalidPrereleaseError}.
 *
 * @privateRemarks
 * Marked `@public` (rather than `@internal`) because `InvalidPrereleaseError` extends
 * it directly: API Extractor requires a class's release tag to be at least as public
 * as every type in its `extends` clause. Consumers should use
 * {@link InvalidPrereleaseError} directly rather than referencing this base.
 *
 * @public
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
 * @public
 */
export class InvalidPrereleaseError extends InvalidPrereleaseErrorBase<{
	/** The invalid prerelease identifier string. */
	readonly input: string;
}> {
	get message(): string {
		return `Invalid prerelease identifier: "${this.input}"`;
	}
}
