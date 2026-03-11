import { Data } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Tagged error base for {@link VersionNotFoundError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `VersionNotFoundError` appears in public type signatures.
 * Consumers should use {@link VersionNotFoundError} directly.
 *
 * @internal
 */
export const VersionNotFoundErrorBase = Data.TaggedError("VersionNotFoundError");

/**
 * Indicates that a specific version was not found in the {@link VersionCache}.
 *
 * Returned by navigation operations (`diff`, `next`, `prev`) when the referenced
 * version has not been loaded into the cache.
 *
 * @see {@link VersionCache}
 */
export class VersionNotFoundError extends VersionNotFoundErrorBase<{
	/** The version that was not found in the cache. */
	readonly version: SemVer;
}> {
	get message(): string {
		return `Version not found in cache: ${this.version.toString()}`;
	}
}
