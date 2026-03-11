import { Data } from "effect";

/**
 * Tagged error base for {@link EmptyCacheError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `EmptyCacheError` appears in public type signatures.
 * Consumers should use {@link EmptyCacheError} directly.
 *
 * @internal
 */
export const EmptyCacheErrorBase = Data.TaggedError("EmptyCacheError");

/**
 * Indicates that a {@link VersionCache} operation was attempted on an empty cache.
 *
 * Returned by query and grouping operations (e.g., `versions`, `latest`, `oldest`,
 * `groupBy`) when no versions have been loaded into the cache.
 *
 * @see {@link VersionCache}
 */
export class EmptyCacheError extends EmptyCacheErrorBase {
	get message(): string {
		return "Version cache is empty";
	}
}
