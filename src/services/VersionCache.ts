import type { Effect, Option } from "effect";
import { Context } from "effect";
import type { EmptyCacheError } from "../errors/EmptyCacheError.js";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import type { UnsatisfiedRangeError } from "../errors/UnsatisfiedRangeError.js";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";
import type { VersionDiff } from "../schemas/VersionDiff.js";

/**
 * Effect service interface for an in-memory sorted version cache.
 *
 * Provides mutation, query, resolution, grouping, and navigation operations
 * over a set of {@link SemVer} versions. Versions are maintained in sorted
 * order using {@link SemVerOrder}.
 *
 * Use {@link VersionCacheLive} to provide a concrete implementation backed by
 * an Effect `Ref` of a `SortedSet`.
 *
 * @example
 * ```typescript
 * import { VersionCache, VersionCacheLive, SemVerParserLive, parseVersion, parseRange } from "semver-effect";
 * import { Effect, Layer } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* VersionCache;
 *   const v1 = yield* parseVersion("1.0.0");
 *   const v2 = yield* parseVersion("2.0.0");
 *   yield* cache.load([v1, v2]);
 *   const latest = yield* cache.latest();
 *   console.log(latest.toString()); // "2.0.0"
 * }).pipe(Effect.provide(Layer.merge(VersionCacheLive, SemVerParserLive)));
 * ```
 *
 * @see {@link VersionCacheLive}
 * @see {@link https://effect.website/docs/context-management/services | Effect Services}
 */
export interface VersionCache {
	// Mutation (infallible)

	/** Replace all cached versions with the given array. */
	readonly load: (versions: ReadonlyArray<SemVer>) => Effect.Effect<void, never>;
	/** Add a single version to the cache. */
	readonly add: (version: SemVer) => Effect.Effect<void, never>;
	/** Remove a single version from the cache. */
	readonly remove: (version: SemVer) => Effect.Effect<void, never>;

	// Query

	/** Retrieve all cached versions in sorted order. Fails with {@link EmptyCacheError} if empty. */
	readonly versions: Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;
	/** Retrieve the highest version in the cache. Fails with {@link EmptyCacheError} if empty. */
	readonly latest: () => Effect.Effect<SemVer, EmptyCacheError>;
	/** Retrieve the lowest version in the cache. Fails with {@link EmptyCacheError} if empty. */
	readonly oldest: () => Effect.Effect<SemVer, EmptyCacheError>;

	// Resolution

	/** Find the highest version satisfying a {@link Range}. Fails with {@link UnsatisfiedRangeError} if none match. */
	readonly resolve: (range: Range) => Effect.Effect<SemVer, UnsatisfiedRangeError>;
	/** Parse a range string and resolve it. Fails with {@link InvalidRangeError} or {@link UnsatisfiedRangeError}. */
	readonly resolveString: (input: string) => Effect.Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError>;
	/**
	 * Return all cached versions satisfying a {@link Range}.
	 * Fails with {@link EmptyCacheError} if the cache is empty (nothing loaded).
	 * Returns an empty array if the cache is non-empty but no versions match.
	 */
	readonly filter: (range: Range) => Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;

	// Grouping

	/** Group cached versions by major, minor, or patch level. Fails with {@link EmptyCacheError} if empty. */
	readonly groupBy: (
		strategy: "major" | "minor" | "patch",
	) => Effect.Effect<Map<string, ReadonlyArray<SemVer>>, EmptyCacheError>;
	/** Return the latest version for each distinct major version. Fails with {@link EmptyCacheError} if empty. */
	readonly latestByMajor: () => Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;
	/** Return the latest version for each distinct major.minor pair. Fails with {@link EmptyCacheError} if empty. */
	readonly latestByMinor: () => Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;

	// Navigation

	/** Compute a {@link VersionDiff} between two versions. Fails with {@link VersionNotFoundError} if either is missing. */
	readonly diff: (a: SemVer, b: SemVer) => Effect.Effect<VersionDiff, VersionNotFoundError>;
	/** Get the next higher version after the given one. Fails with {@link VersionNotFoundError} if not in cache. */
	readonly next: (version: SemVer) => Effect.Effect<Option.Option<SemVer>, VersionNotFoundError>;
	/** Get the next lower version before the given one. Fails with {@link VersionNotFoundError} if not in cache. */
	readonly prev: (version: SemVer) => Effect.Effect<Option.Option<SemVer>, VersionNotFoundError>;
}

/**
 * Effect Context tag for the {@link VersionCache} service.
 *
 * @see {@link VersionCacheLive}
 */
export const VersionCache = Context.GenericTag<VersionCache>("VersionCache");
