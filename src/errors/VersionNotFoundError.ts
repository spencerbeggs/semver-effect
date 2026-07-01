import { Data } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Tagged error base for {@link VersionNotFoundError}.
 *
 * @privateRemarks
 * Marked `@public` (rather than `@internal`) because `VersionNotFoundError` extends
 * it directly: API Extractor requires a class's release tag to be at least as public
 * as every type in its `extends` clause. Consumers should use
 * {@link VersionNotFoundError} directly rather than referencing this base.
 *
 * @public
 */
export const VersionNotFoundErrorBase = Data.TaggedError("VersionNotFoundError");

/**
 * Indicates that a specific version was not found in the {@link VersionCache}.
 *
 * Returned by navigation operations (`diff`, `next`, `prev`) when the referenced
 * version has not been loaded into the cache.
 *
 * @see {@link VersionCache}
 * @public
 */
export class VersionNotFoundError extends VersionNotFoundErrorBase<{
	/** The version that was not found in the cache. */
	readonly version: SemVer;
}> {
	get message(): string {
		return `Version not found in cache: ${this.version.toString()}`;
	}
}
