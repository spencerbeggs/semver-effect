import { Data } from "effect";

/**
 * Tagged error base for {@link EmptyCacheError}.
 *
 * @privateRemarks
 * Marked `@public` (rather than `@internal`) because `EmptyCacheError` extends it
 * directly: API Extractor requires a class's release tag to be at least as public
 * as every type in its `extends` clause. Consumers should use {@link EmptyCacheError}
 * directly rather than referencing this base.
 *
 * @public
 */
export const EmptyCacheErrorBase = Data.TaggedError("EmptyCacheError");

/**
 * Indicates that a {@link VersionCache} operation was attempted on an empty cache.
 *
 * Returned by query and grouping operations (e.g., `versions`, `latest`, `oldest`,
 * `groupBy`) when no versions have been loaded into the cache.
 *
 * @see {@link VersionCache}
 * @public
 */
export class EmptyCacheError extends EmptyCacheErrorBase {
	get message(): string {
		return "Version cache is empty";
	}
}
