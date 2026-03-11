import { Data } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Tagged error base for {@link InvalidBumpError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `InvalidBumpError` appears in public type signatures.
 * Consumers should use {@link InvalidBumpError} directly.
 *
 * @internal
 */
export const InvalidBumpErrorBase = Data.TaggedError("InvalidBumpError");

/**
 * Indicates that a version bump operation cannot be applied to the given version.
 *
 * @see {@link bumpMajor}
 * @see {@link bumpMinor}
 * @see {@link bumpPatch}
 * @see {@link bumpPrerelease}
 * @see {@link bumpRelease}
 */
export class InvalidBumpError extends InvalidBumpErrorBase<{
	/** The version that the bump was attempted on. */
	readonly version: SemVer;
	/** The bump type that was requested (e.g., `"major"`, `"prerelease"`). */
	readonly type: string;
}> {
	get message(): string {
		return `Cannot apply ${this.type} bump to version ${this.version.toString()}`;
	}
}
