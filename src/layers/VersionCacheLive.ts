import { Effect, Layer, Option, Ref, SortedSet } from "effect";
import { EmptyCacheError } from "../errors/EmptyCacheError.js";
import { UnsatisfiedRangeError } from "../errors/UnsatisfiedRangeError.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";
import { SemVerParser } from "../services/SemVerParser.js";
import { VersionCache } from "../services/VersionCache.js";
import { diff as computeDiff } from "../utils/diff.js";
import { satisfies as matchSatisfies } from "../utils/matching.js";
import { SemVerOrder } from "../utils/order.js";

const toArray = (set: SortedSet.SortedSet<SemVer>): ReadonlyArray<SemVer> => Array.from(SortedSet.values(set));

const requireNonEmpty = (set: SortedSet.SortedSet<SemVer>): Effect.Effect<ReadonlyArray<SemVer>, EmptyCacheError> => {
	if (SortedSet.size(set) === 0) {
		return Effect.fail(new EmptyCacheError());
	}
	return Effect.succeed(toArray(set));
};

/**
 * Live Effect {@link Layer} that provides the {@link VersionCache} service.
 *
 * Backed by an Effect `Ref` containing a `SortedSet` ordered by {@link SemVerOrder}.
 * Requires a {@link SemVerParser} in its dependency graph (used by `resolveString`
 * to parse range strings).
 *
 * @example
 * ```typescript
 * import { VersionCache, VersionCacheLive, SemVerParserLive, parseVersion } from "semver-effect";
 * import { Effect, Layer } from "effect";
 *
 * const AppLayer = Layer.merge(VersionCacheLive, SemVerParserLive);
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* VersionCache;
 *   const v = yield* parseVersion("1.0.0");
 *   yield* cache.add(v);
 *   const latest = yield* cache.latest();
 * }).pipe(Effect.provide(AppLayer));
 * ```
 *
 * @see {@link VersionCache}
 * @see {@link SemVerParserLive}
 * @see {@link https://effect.website/docs/context-management/layers | Effect Layers}
 */
export const VersionCacheLive: Layer.Layer<VersionCache, never, SemVerParser> = Layer.effect(
	VersionCache,
	Effect.gen(function* () {
		const parser = yield* SemVerParser;
		const ref = yield* Ref.make(SortedSet.empty<SemVer>(SemVerOrder));

		const resolveFromRef = (range: Range) =>
			Effect.flatMap(Ref.get(ref), (set) => {
				const arr = toArray(set);
				for (let i = arr.length - 1; i >= 0; i--) {
					if (matchSatisfies(arr[i], range)) {
						return Effect.succeed(arr[i]);
					}
				}
				return Effect.fail(new UnsatisfiedRangeError({ range, available: arr }));
			});

		return VersionCache.of({
			load: (versions) => Ref.set(ref, SortedSet.fromIterable(versions, SemVerOrder)),

			add: (version) => Ref.update(ref, SortedSet.add(version)),

			remove: (version) => Ref.update(ref, SortedSet.remove(version)),

			get versions() {
				return Effect.flatMap(Ref.get(ref), requireNonEmpty);
			},

			latest: () =>
				Effect.flatMap(Ref.get(ref), (set) => {
					const arr = toArray(set);
					if (arr.length === 0) return Effect.fail(new EmptyCacheError());
					return Effect.succeed(arr[arr.length - 1]);
				}),

			oldest: () =>
				Effect.flatMap(Ref.get(ref), (set) => {
					const arr = toArray(set);
					if (arr.length === 0) return Effect.fail(new EmptyCacheError());
					return Effect.succeed(arr[0]);
				}),

			resolve: (range) => resolveFromRef(range),

			resolveString: (input) => Effect.flatMap(parser.parseRange(input), resolveFromRef),

			filter: (range) =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (SortedSet.size(set) === 0) {
						return Effect.fail(new EmptyCacheError());
					}
					const arr = toArray(set);
					return Effect.succeed(arr.filter((v) => matchSatisfies(v, range)));
				}),

			groupBy: (strategy) =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (SortedSet.size(set) === 0) {
						return Effect.fail(new EmptyCacheError());
					}
					const arr = toArray(set);
					const map = new Map<string, Array<SemVer>>();
					for (const ver of arr) {
						let key: string;
						switch (strategy) {
							case "major":
								key = `${ver.major}`;
								break;
							case "minor":
								key = `${ver.major}.${ver.minor}`;
								break;
							case "patch":
								key = `${ver.major}.${ver.minor}.${ver.patch}`;
								break;
						}
						const group = map.get(key);
						if (group) {
							group.push(ver);
						} else {
							map.set(key, [ver]);
						}
					}
					return Effect.succeed(map as Map<string, ReadonlyArray<SemVer>>);
				}),

			latestByMajor: () =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (SortedSet.size(set) === 0) {
						return Effect.fail(new EmptyCacheError());
					}
					const arr = toArray(set);
					const map = new Map<number, SemVer>();
					for (const ver of arr) {
						map.set(ver.major, ver);
					}
					return Effect.succeed(Array.from(map.values()));
				}),

			latestByMinor: () =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (SortedSet.size(set) === 0) {
						return Effect.fail(new EmptyCacheError());
					}
					const arr = toArray(set);
					const map = new Map<string, SemVer>();
					for (const ver of arr) {
						map.set(`${ver.major}.${ver.minor}`, ver);
					}
					return Effect.succeed(Array.from(map.values()));
				}),

			diff: (a, b) =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (!SortedSet.has(set, a)) {
						return Effect.fail(new VersionNotFoundError({ version: a }));
					}
					if (!SortedSet.has(set, b)) {
						return Effect.fail(new VersionNotFoundError({ version: b }));
					}
					return Effect.succeed(computeDiff(a, b));
				}),

			next: (version) =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (!SortedSet.has(set, version)) {
						return Effect.fail(new VersionNotFoundError({ version }));
					}
					const arr = toArray(set);
					const idx = arr.findIndex((v) => SemVerOrder(v, version) === 0);
					if (idx < arr.length - 1) {
						return Effect.succeed(Option.some(arr[idx + 1]));
					}
					return Effect.succeed(Option.none());
				}),

			prev: (version) =>
				Effect.flatMap(Ref.get(ref), (set) => {
					if (!SortedSet.has(set, version)) {
						return Effect.fail(new VersionNotFoundError({ version }));
					}
					const arr = toArray(set);
					const idx = arr.findIndex((v) => SemVerOrder(v, version) === 0);
					if (idx > 0) {
						return Effect.succeed(Option.some(arr[idx - 1]));
					}
					return Effect.succeed(Option.none());
				}),
		});
	}),
);
