import { Data } from "effect";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Tagged error base for {@link UnsatisfiedRangeError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `UnsatisfiedRangeError` appears in public type signatures.
 * Consumers should use {@link UnsatisfiedRangeError} directly.
 *
 * @internal
 */
export const UnsatisfiedRangeErrorBase = Data.TaggedError("UnsatisfiedRangeError");

/**
 * Indicates that no version in a given set satisfies a {@link Range}.
 *
 * Returned by {@link VersionCache.resolve} and {@link VersionCache.resolveString}
 * when the cache contains versions but none match the requested range.
 *
 * @see {@link VersionCache}
 * @see {@link Range}
 */
export class UnsatisfiedRangeError extends UnsatisfiedRangeErrorBase<{
	/** The range that could not be satisfied. */
	readonly range: Range;
	/** The versions that were available for matching. */
	readonly available: ReadonlyArray<SemVer>;
}> {
	get message(): string {
		const count = this.available.length;
		return `No version satisfies range ${this.range.toString()} (${count} version${count === 1 ? "" : "s"} available)`;
	}
}
