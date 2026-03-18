import { Schema } from "effect";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import { Comparator } from "./Comparator.js";
import type { SemVer } from "./SemVer.js";

/**
 * A comparator set: an array of {@link Comparator} instances combined with AND
 * semantics. A version must satisfy every comparator in the set to match.
 *
 * @see {@link Range}
 */
export type ComparatorSet = ReadonlyArray<Comparator>;

/**
 * A SemVer range expression, represented as a union (OR) of {@link ComparatorSet}s.
 *
 * @example
 * ```typescript
 * import { Range, SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const range = yield* Range.parse("^1.0.0");
 *   const v = new SemVer({ major: 1, minor: 5, patch: 0, prerelease: [], build: [] });
 *   console.log(range.test(v));  // true
 * });
 * ```
 *
 * @see {@link Comparator}
 * @see {@link ComparatorSet}
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 */
export class Range extends Schema.TaggedClass<Range>()("Range", {
	sets: Schema.Array(Schema.Array(Comparator)),
}) {
	// ── Cross-cutting statics (wired in index.ts) ───────────────────────

	/** Parse a SemVer range expression. Wired at module load by index.ts. */
	static parse: (input: string) => import("effect/Effect").Effect<Range, InvalidRangeError>;

	/** Test whether a version satisfies a range. Dual API. Wired at module load. */
	static satisfies: {
		(range: Range): (version: SemVer) => boolean;
		(version: SemVer, range: Range): boolean;
	};

	/** Filter versions that satisfy a range. Dual API. Wired at module load. */
	static filter: {
		(range: Range): (versions: ReadonlyArray<SemVer>) => ReadonlyArray<SemVer>;
		(versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer>;
	};

	/** Highest satisfying version. Dual API. Wired at module load. */
	static maxSatisfying: {
		(range: Range): (versions: ReadonlyArray<SemVer>) => import("effect/Option").Option<SemVer>;
		(versions: ReadonlyArray<SemVer>, range: Range): import("effect/Option").Option<SemVer>;
	};

	/** Lowest satisfying version. Dual API. Wired at module load. */
	static minSatisfying: {
		(range: Range): (versions: ReadonlyArray<SemVer>) => import("effect/Option").Option<SemVer>;
		(versions: ReadonlyArray<SemVer>, range: Range): import("effect/Option").Option<SemVer>;
	};

	// ── Instance methods ────────────────────────────────────────────────

	/** Test whether a version satisfies this range. */
	test(version: SemVer): boolean {
		return this.sets.some((set) => satisfiesSet(version, set));
	}

	/** Filter versions that satisfy this range, preserving order. */
	filter(versions: ReadonlyArray<SemVer>): ReadonlyArray<SemVer> {
		return versions.filter((v) => this.test(v));
	}

	// ── Display ─────────────────────────────────────────────────────────

	toString(): string {
		return this.sets.map((set) => set.map((c) => c.toString()).join(" ")).join(" || ");
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}

// ── Inlined matching logic (avoids circular import with utils/matching) ─

const satisfiesSet = (version: SemVer, set: ReadonlyArray<Comparator>): boolean => {
	if (set.length === 0) return true;

	// Prerelease tuple restriction
	if (version.prerelease.length > 0) {
		const hasTupleMatch = set.some(
			(c) =>
				c.version.prerelease.length > 0 &&
				c.version.major === version.major &&
				c.version.minor === version.minor &&
				c.version.patch === version.patch,
		);
		if (!hasTupleMatch) return false;
	}

	return set.every((c) => c.test(version));
};
