import { Function as Fn, Option } from "effect";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Test whether a {@link SemVer} version satisfies a {@link Range}.
 *
 * For the instance method alternative, use `range.test(version)`.
 *
 * @example
 * ```typescript
 * import { SemVer, Range } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.5.0");
 *   const r = yield* Range.parse("^1.0.0");
 *   console.log(r.test(v));        // true  (instance method)
 *   console.log(satisfies(v, r));  // true  (standalone function)
 * });
 * ```
 *
 * @see {@link filter}
 * @see {@link maxSatisfying}
 * @see {@link minSatisfying}
 * @public
 */
export const satisfies: {
	(range: Range): (version: SemVer) => boolean;
	(version: SemVer, range: Range): boolean;
} = Fn.dual(2, (version: SemVer, range: Range): boolean => range.test(version));

/**
 * Filter an array of {@link SemVer} versions to only those satisfying a {@link Range}.
 *
 * For the instance method alternative, use `range.filter(versions)`.
 *
 * @see {@link satisfies}
 * @public
 */
export const filter: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => ReadonlyArray<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer>;
} = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): ReadonlyArray<SemVer> => range.filter(versions));

/**
 * Find the highest {@link SemVer} version satisfying a {@link Range}.
 *
 * Returns `Option.none()` if no version satisfies the range.
 *
 * @see {@link minSatisfying}
 * @see {@link satisfies}
 * @public
 */
export const maxSatisfying: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => Option.Option<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer>;
} = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer> => {
	let best: SemVer | null = null;
	for (const v of versions) {
		if (range.test(v)) {
			if (best === null || v.compare(best) > 0) best = v;
		}
	}
	return best === null ? Option.none() : Option.some(best);
});

/**
 * Find the lowest {@link SemVer} version satisfying a {@link Range}.
 *
 * Returns `Option.none()` if no version satisfies the range.
 *
 * @see {@link maxSatisfying}
 * @see {@link satisfies}
 * @public
 */
export const minSatisfying: {
	(range: Range): (versions: ReadonlyArray<SemVer>) => Option.Option<SemVer>;
	(versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer>;
} = Fn.dual(2, (versions: ReadonlyArray<SemVer>, range: Range): Option.Option<SemVer> => {
	let best: SemVer | null = null;
	for (const v of versions) {
		if (range.test(v)) {
			if (best === null || v.compare(best) < 0) best = v;
		}
	}
	return best === null ? Option.none() : Option.some(best);
});
