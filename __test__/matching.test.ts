import { Effect, Option, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";

const v = SemVer.make;

const r = (input: string) => Effect.runSync(Range.fromString(input));

describe("satisfies", () => {
	it("1.5.0 satisfies >=1.0.0 <2.0.0", () => {
		expect(Range.satisfies(v(1, 5, 0), r(">=1.0.0 <2.0.0"))).toBe(true);
	});

	it("2.0.0 does not satisfy >=1.0.0 <2.0.0", () => {
		expect(Range.satisfies(v(2, 0, 0), r(">=1.0.0 <2.0.0"))).toBe(false);
	});

	it("1.0.0 satisfies * (wildcard)", () => {
		expect(Range.satisfies(v(1, 0, 0), r(">=0.0.0"))).toBe(true);
	});

	it("1.2.3 satisfies exact match 1.2.3", () => {
		expect(Range.satisfies(v(1, 2, 3), r("1.2.3"))).toBe(true);
	});

	it("0.0.0 satisfies >=0.0.0", () => {
		expect(Range.satisfies(v(0, 0, 0), r(">=0.0.0"))).toBe(true);
	});

	describe("prerelease matching rules", () => {
		it("3.0.0-beta.1 satisfies >=3.0.0-alpha.1 (same tuple)", () => {
			expect(Range.satisfies(v(3, 0, 0, ["beta", 1]), r(">=3.0.0-alpha.1"))).toBe(true);
		});

		it("3.0.0-beta.1 does NOT satisfy >=2.9.0 (no comparator with prerelease on [3,0,0])", () => {
			expect(Range.satisfies(v(3, 0, 0, ["beta", 1]), r(">=2.9.0"))).toBe(false);
		});

		it("1.0.0-rc.1 does NOT satisfy >=0.9.0 <2.0.0 (neither comparator has prerelease on [1,0,0])", () => {
			expect(Range.satisfies(v(1, 0, 0, ["rc", 1]), r(">=0.9.0 <2.0.0"))).toBe(false);
		});

		it("1.0.0-rc.1 satisfies >=1.0.0-alpha.1 <2.0.0 (first comp has prerelease on [1,0,0])", () => {
			expect(Range.satisfies(v(1, 0, 0, ["rc", 1]), r(">=1.0.0-alpha.1 <2.0.0"))).toBe(true);
		});
	});
});

describe("filter", () => {
	it("filters versions matching a range and preserves order", () => {
		const versions = [v(1, 0, 0), v(2, 0, 0), v(1, 5, 0), v(3, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		const result = Range.filter(versions, range);
		expect(result).toEqual([v(1, 0, 0), v(1, 5, 0)]);
	});

	it("returns empty array when none match", () => {
		const versions = [v(3, 0, 0), v(4, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		expect(Range.filter(versions, range)).toEqual([]);
	});
});

describe("maxSatisfying", () => {
	it("returns Option.some(highest matching)", () => {
		const versions = [v(1, 0, 0), v(1, 5, 0), v(1, 9, 9), v(2, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		const result = Range.maxSatisfying(versions, range);
		expect(Option.isSome(result)).toBe(true);
		expect(Option.getOrThrow(result)).toEqual(v(1, 9, 9));
	});

	it("returns Option.none() when none match", () => {
		const versions = [v(3, 0, 0), v(4, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		expect(Option.isNone(Range.maxSatisfying(versions, range))).toBe(true);
	});
});

describe("minSatisfying", () => {
	it("returns Option.some(lowest matching)", () => {
		const versions = [v(1, 0, 0), v(1, 5, 0), v(1, 9, 9), v(2, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		const result = Range.minSatisfying(versions, range);
		expect(Option.isSome(result)).toBe(true);
		expect(Option.getOrThrow(result)).toEqual(v(1, 0, 0));
	});

	it("returns Option.none() when none match", () => {
		const versions = [v(3, 0, 0), v(4, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		expect(Option.isNone(Range.minSatisfying(versions, range))).toBe(true);
	});
});

describe("dual API", () => {
	it("pipe(version, satisfies(range)) works same as satisfies(version, range)", () => {
		const version = v(1, 5, 0);
		const range = r(">=1.0.0 <2.0.0");
		expect(pipe(version, Range.satisfies(range))).toBe(Range.satisfies(version, range));
	});

	it("pipe(versions, filter(range)) works", () => {
		const versions = [v(1, 0, 0), v(2, 0, 0), v(1, 5, 0)];
		const range = r(">=1.0.0 <2.0.0");
		expect(pipe(versions, Range.filter(range))).toEqual(Range.filter(versions, range));
	});

	it("pipe(versions, maxSatisfying(range)) works", () => {
		const versions = [v(1, 0, 0), v(1, 5, 0), v(2, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		expect(pipe(versions, Range.maxSatisfying(range))).toEqual(Range.maxSatisfying(versions, range));
	});

	it("pipe(versions, minSatisfying(range)) works", () => {
		const versions = [v(1, 0, 0), v(1, 5, 0), v(2, 0, 0)];
		const range = r(">=1.0.0 <2.0.0");
		expect(pipe(versions, Range.minSatisfying(range))).toEqual(Range.minSatisfying(versions, range));
	});
});
