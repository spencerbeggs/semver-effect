import type { Effect, Option } from "effect";
import { Context } from "effect";
import type { EmptyCacheError } from "../errors/EmptyCacheError.js";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import type { UnsatisfiedRangeError } from "../errors/UnsatisfiedRangeError.js";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";
import type { VersionDiff } from "../schemas/VersionDiff.js";

export interface VersionCache {
	// Mutation (infallible)
	readonly load: (versions: ReadonlyArray<SemVer>) => Effect.Effect<void, never>;
	readonly add: (version: SemVer) => Effect.Effect<void, never>;
	readonly remove: (version: SemVer) => Effect.Effect<void, never>;

	// Query
	readonly versions: Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;
	readonly latest: () => Effect.Effect<SemVer, EmptyCacheError>;
	readonly oldest: () => Effect.Effect<SemVer, EmptyCacheError>;

	// Resolution
	readonly resolve: (range: Range) => Effect.Effect<SemVer, UnsatisfiedRangeError>;
	readonly resolveString: (input: string) => Effect.Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError>;
	readonly filter: (range: Range) => Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;

	// Grouping
	readonly groupBy: (
		strategy: "major" | "minor" | "patch",
	) => Effect.Effect<Map<string, ReadonlyArray<SemVer>>, EmptyCacheError>;
	readonly latestByMajor: () => Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;
	readonly latestByMinor: () => Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError>;

	// Navigation
	readonly diff: (a: SemVer, b: SemVer) => Effect.Effect<VersionDiff, VersionNotFoundError>;
	readonly next: (version: SemVer) => Effect.Effect<Option.Option<SemVer>, VersionNotFoundError>;
	readonly prev: (version: SemVer) => Effect.Effect<Option.Option<SemVer>, VersionNotFoundError>;
}

export const VersionCache = Context.GenericTag<VersionCache>("VersionCache");
