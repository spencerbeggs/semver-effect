import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import { SemVerParserLive } from "../src/layers/SemVerParserLive.js";
import { VersionCacheLive } from "../src/layers/VersionCacheLive.js";
import { SemVer } from "../src/schemas/SemVer.js";
import { VersionCache } from "../src/services/VersionCache.js";
import { parseRangeSet } from "../src/utils/grammar.js";
import { normalizeRange } from "../src/utils/normalize.js";

const TestLayer = VersionCacheLive.pipe(Layer.provide(SemVerParserLive));

const run = <A, E>(effect: Effect.Effect<A, E, VersionCache>) => Effect.runSync(Effect.provide(effect, TestLayer));

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });

const r = (input: string) => Effect.runSync(Effect.map(parseRangeSet(input), normalizeRange));

describe("VersionCache - Mutation", () => {
	it("load replaces cache contents", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0)]);
				return yield* cache.versions;
			}),
		);
		expect(result.map(String)).toEqual(["1.0.0", "2.0.0"]);
	});

	it("load with empty array makes cache empty", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					yield* cache.load([v(1, 0, 0)]);
					yield* cache.load([]);
					return yield* cache.versions;
				}),
			),
		).toThrow(/empty/i);
	});

	it("add inserts a version in sorted order", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.add(v(2, 0, 0));
				yield* cache.add(v(1, 0, 0));
				yield* cache.add(v(3, 0, 0));
				return yield* cache.versions;
			}),
		);
		expect(result.map(String)).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
	});

	it("add duplicate is no-op", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.add(v(1, 0, 0));
				yield* cache.add(v(1, 0, 0));
				return yield* cache.versions;
			}),
		);
		expect(result).toHaveLength(1);
	});

	it("remove deletes a version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0), v(3, 0, 0)]);
				yield* cache.remove(v(2, 0, 0));
				return yield* cache.versions;
			}),
		);
		expect(result.map(String)).toEqual(["1.0.0", "3.0.0"]);
	});

	it("remove non-existent version is no-op", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0)]);
				yield* cache.remove(v(9, 9, 9));
				return yield* cache.versions;
			}),
		);
		expect(result.map(String)).toEqual(["1.0.0"]);
	});
});

describe("VersionCache - Query", () => {
	it("versions fails with EmptyCacheError when empty", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					return yield* cache.versions;
				}),
			),
		).toThrow(/empty/i);
	});

	it("versions returns sorted array", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(3, 0, 0), v(1, 0, 0), v(2, 0, 0)]);
				return yield* cache.versions;
			}),
		);
		expect(result.map(String)).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
	});

	it("latest returns highest version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(3, 0, 0), v(2, 0, 0)]);
				return yield* cache.latest();
			}),
		);
		expect(String(result)).toBe("3.0.0");
	});

	it("latest fails on empty cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					return yield* cache.latest();
				}),
			),
		).toThrow(/empty/i);
	});

	it("oldest returns lowest version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(3, 0, 0), v(1, 0, 0), v(2, 0, 0)]);
				return yield* cache.oldest();
			}),
		);
		expect(String(result)).toBe("1.0.0");
	});

	it("oldest fails on empty cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					return yield* cache.oldest();
				}),
			),
		).toThrow(/empty/i);
	});
});

describe("VersionCache - Resolution", () => {
	it("resolve returns highest matching version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 5, 0), v(2, 0, 0), v(2, 1, 0), v(3, 0, 0)]);
				return yield* cache.resolve(r(">=1.0.0 <2.0.0"));
			}),
		);
		expect(String(result)).toBe("1.5.0");
	});

	it("resolve fails with UnsatisfiedRangeError when no match", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					yield* cache.load([v(1, 0, 0)]);
					return yield* cache.resolve(r(">=5.0.0"));
				}),
			),
		).toThrow(/No version satisfies/);
	});

	it("resolve on empty cache fails with UnsatisfiedRangeError", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					return yield* cache.resolve(r(">=1.0.0"));
				}),
			),
		).toThrow(/No version satisfies/);
	});

	it("resolveString parses and resolves in one step", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 2, 0), v(2, 0, 0)]);
				return yield* cache.resolveString("^1.0.0");
			}),
		);
		expect(String(result)).toBe("1.2.0");
	});

	it("resolveString fails on invalid range string", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					yield* cache.load([v(1, 0, 0)]);
					return yield* cache.resolveString("bad!");
				}),
			),
		).toThrow(/Invalid range/);
	});

	it("filter returns matching versions in order", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 5, 0), v(2, 0, 0), v(2, 1, 0), v(3, 0, 0)]);
				return yield* cache.filter(r(">=1.0.0 <2.0.0"));
			}),
		);
		expect(result.map(String)).toEqual(["1.0.0", "1.5.0"]);
	});

	it("filter returns empty array when none match", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0)]);
				return yield* cache.filter(r(">=5.0.0"));
			}),
		);
		expect(result).toEqual([]);
	});

	it("filter fails with EmptyCacheError on empty cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					return yield* cache.filter(r(">=1.0.0"));
				}),
			),
		).toThrow(/empty/i);
	});
});

describe("VersionCache - Grouping", () => {
	it("groupBy major groups versions by major number", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 2, 3), v(2, 0, 0), v(2, 1, 0), v(3, 0, 0)]);
				return yield* cache.groupBy("major");
			}),
		);
		expect(result.get("1")?.map(String)).toEqual(["1.0.0", "1.2.3"]);
		expect(result.get("2")?.map(String)).toEqual(["2.0.0", "2.1.0"]);
		expect(result.get("3")?.map(String)).toEqual(["3.0.0"]);
	});

	it("groupBy minor groups versions by major.minor", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 0, 3), v(1, 1, 0), v(1, 1, 2)]);
				return yield* cache.groupBy("minor");
			}),
		);
		expect(result.get("1.0")?.map(String)).toEqual(["1.0.0", "1.0.3"]);
		expect(result.get("1.1")?.map(String)).toEqual(["1.1.0", "1.1.2"]);
	});

	it("groupBy patch groups by major.minor.patch", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["beta"])]);
				return yield* cache.groupBy("patch");
			}),
		);
		expect(result.get("1.0.0")?.map(String)).toEqual(["1.0.0-alpha", "1.0.0-beta", "1.0.0"]);
	});

	it("groupBy fails on empty cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					return yield* cache.groupBy("major");
				}),
			),
		).toThrow(/empty/i);
	});

	it("latestByMajor returns highest per major line", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 2, 3), v(2, 0, 0), v(2, 1, 0), v(3, 0, 0, ["beta", 1])]);
				return yield* cache.latestByMajor();
			}),
		);
		expect(result.map(String)).toEqual(["1.2.3", "2.1.0", "3.0.0-beta.1"]);
	});

	it("latestByMinor returns highest per minor line", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(1, 0, 3), v(1, 1, 0), v(1, 1, 2), v(2, 0, 0)]);
				return yield* cache.latestByMinor();
			}),
		);
		expect(result.map(String)).toEqual(["1.0.3", "1.1.2", "2.0.0"]);
	});
});

describe("VersionCache - Navigation", () => {
	it("diff returns VersionDiff for two cached versions", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0)]);
				return yield* cache.diff(v(1, 0, 0), v(2, 0, 0));
			}),
		);
		expect(result.type).toBe("major");
		expect(result.major).toBe(1);
	});

	it("diff fails if version not in cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					yield* cache.load([v(1, 0, 0)]);
					return yield* cache.diff(v(1, 0, 0), v(9, 9, 9));
				}),
			),
		).toThrow(/not found/i);
	});

	it("next returns the next higher version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0), v(3, 0, 0)]);
				return yield* cache.next(v(2, 0, 0));
			}),
		);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("3.0.0");
	});

	it("next returns None for highest version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0)]);
				return yield* cache.next(v(2, 0, 0));
			}),
		);
		expect(Option.isNone(result)).toBe(true);
	});

	it("next fails if version not in cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					yield* cache.load([v(1, 0, 0)]);
					return yield* cache.next(v(9, 9, 9));
				}),
			),
		).toThrow(/not found/i);
	});

	it("prev returns the next lower version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0), v(3, 0, 0)]);
				return yield* cache.prev(v(2, 0, 0));
			}),
		);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0");
	});

	it("prev returns None for lowest version", () => {
		const result = run(
			Effect.gen(function* () {
				const cache = yield* VersionCache;
				yield* cache.load([v(1, 0, 0), v(2, 0, 0)]);
				return yield* cache.prev(v(1, 0, 0));
			}),
		);
		expect(Option.isNone(result)).toBe(true);
	});

	it("prev fails if version not in cache", () => {
		expect(() =>
			run(
				Effect.gen(function* () {
					const cache = yield* VersionCache;
					yield* cache.load([v(1, 0, 0)]);
					return yield* cache.prev(v(9, 9, 9));
				}),
			),
		).toThrow(/not found/i);
	});
});
