import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { parseComparator, parseRange, parseVersion } from "../src/index.js";
import { SemVerParserLive } from "../src/layers/SemVerParserLive.js";
import { SemVerParser } from "../src/services/SemVerParser.js";

const runWithParser = <A, E>(effect: Effect.Effect<A, E, SemVerParser>) =>
	Effect.runSync(Effect.provide(effect, SemVerParserLive));

describe("SemVerParser service (via Layer)", () => {
	it("parseVersion parses a valid semver string", () => {
		const result = runWithParser(
			Effect.gen(function* () {
				const parser = yield* SemVerParser;
				return yield* parser.parseVersion("1.2.3");
			}),
		);
		expect(result.major).toBe(1);
		expect(result.minor).toBe(2);
		expect(result.patch).toBe(3);
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("parseVersion fails with InvalidVersionError on bad input", () => {
		expect(() =>
			runWithParser(
				Effect.gen(function* () {
					const parser = yield* SemVerParser;
					return yield* parser.parseVersion("bad");
				}),
			),
		).toThrow(/Invalid version string/);
	});

	it("parseRange parses and normalizes a caret range", () => {
		const result = runWithParser(
			Effect.gen(function* () {
				const parser = yield* SemVerParser;
				return yield* parser.parseRange("^1.2.3");
			}),
		);
		expect(result._tag).toBe("Range");
		expect(result.sets.length).toBeGreaterThanOrEqual(1);
	});

	it("parseRange fails with InvalidRangeError on bad input", () => {
		expect(() =>
			runWithParser(
				Effect.gen(function* () {
					const parser = yield* SemVerParser;
					return yield* parser.parseRange("bad!");
				}),
			),
		).toThrow(/Invalid range expression/);
	});

	it("parseComparator parses a valid comparator", () => {
		const result = runWithParser(
			Effect.gen(function* () {
				const parser = yield* SemVerParser;
				return yield* parser.parseComparator(">=1.2.3");
			}),
		);
		expect(result.operator).toBe(">=");
		expect(result.version.major).toBe(1);
		expect(result.version.minor).toBe(2);
		expect(result.version.patch).toBe(3);
	});

	it("parseComparator fails with InvalidComparatorError on bad input", () => {
		expect(() =>
			runWithParser(
				Effect.gen(function* () {
					const parser = yield* SemVerParser;
					return yield* parser.parseComparator(">>1");
				}),
			),
		).toThrow(/Invalid comparator/);
	});
});

describe("Convenience parsing functions (no Layer needed)", () => {
	it("parseVersion returns a SemVer", () => {
		const result = Effect.runSync(parseVersion("1.2.3"));
		expect(result.major).toBe(1);
		expect(result.minor).toBe(2);
		expect(result.patch).toBe(3);
	});

	it("parseVersion fails on invalid input", () => {
		expect(() => Effect.runSync(parseVersion("bad"))).toThrow(/Invalid version string/);
	});

	it("parseRange returns a Range", () => {
		const result = Effect.runSync(parseRange("^1.2.3"));
		expect(result._tag).toBe("Range");
		expect(result.sets.length).toBeGreaterThanOrEqual(1);
	});

	it("parseRange fails on invalid input", () => {
		expect(() => Effect.runSync(parseRange("bad!"))).toThrow(/Invalid range expression/);
	});

	it("parseComparator returns a Comparator", () => {
		const result = Effect.runSync(parseComparator(">=1.2.3"));
		expect(result.operator).toBe(">=");
		expect(result.version.major).toBe(1);
	});

	it("parseComparator fails on invalid input", () => {
		expect(() => Effect.runSync(parseComparator(">>1"))).toThrow(/Invalid comparator/);
	});
});
