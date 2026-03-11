import { Option, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as SemVer from "../src/SemVer.js";

const v = SemVer.make;

describe("compare", () => {
	it("returns -1 when a < b", () => {
		expect(SemVer.compare(v(1, 0, 0), v(2, 0, 0))).toBe(-1);
	});

	it("returns 0 when equal", () => {
		expect(SemVer.compare(v(1, 0, 0), v(1, 0, 0))).toBe(0);
	});

	it("returns 1 when a > b", () => {
		expect(SemVer.compare(v(2, 0, 0), v(1, 0, 0))).toBe(1);
	});

	it("ignores build metadata", () => {
		expect(SemVer.compare(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(0);
	});

	it("works in data-last (pipe) form", () => {
		expect(pipe(v(1, 0, 0), SemVer.compare(v(2, 0, 0)))).toBe(-1);
	});
});

describe("equal", () => {
	it("returns true for identical versions", () => {
		expect(SemVer.equal(v(1, 2, 3), v(1, 2, 3))).toBe(true);
	});

	it("returns true when only build differs", () => {
		expect(SemVer.equal(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(true);
	});

	it("returns false when fields differ", () => {
		expect(SemVer.equal(v(1, 0, 0), v(1, 0, 1))).toBe(false);
	});

	it("returns false when prerelease differs", () => {
		expect(SemVer.equal(v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["beta"]))).toBe(false);
	});
});

describe("gt", () => {
	it("returns true when a > b", () => {
		expect(SemVer.gt(v(2, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns false when a < b", () => {
		expect(SemVer.gt(v(1, 0, 0), v(2, 0, 0))).toBe(false);
	});

	it("returns false when equal", () => {
		expect(SemVer.gt(v(1, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("1.0.0 > 1.0.0-alpha (release > prerelease)", () => {
		expect(SemVer.gt(v(1, 0, 0), v(1, 0, 0, ["alpha"]))).toBe(true);
	});
});

describe("gte", () => {
	it("returns true when a > b", () => {
		expect(SemVer.gte(v(2, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns true when equal", () => {
		expect(SemVer.gte(v(1, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns false when a < b", () => {
		expect(SemVer.gte(v(1, 0, 0), v(2, 0, 0))).toBe(false);
	});
});

describe("lt", () => {
	it("returns true when a < b", () => {
		expect(SemVer.lt(v(1, 0, 0), v(2, 0, 0))).toBe(true);
	});

	it("returns false when a > b", () => {
		expect(SemVer.lt(v(2, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("returns false when equal", () => {
		expect(SemVer.lt(v(1, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("1.0.0-alpha < 1.0.0 (prerelease < release)", () => {
		expect(SemVer.lt(v(1, 0, 0, ["alpha"]), v(1, 0, 0))).toBe(true);
	});
});

describe("lte", () => {
	it("returns true when a < b", () => {
		expect(SemVer.lte(v(1, 0, 0), v(2, 0, 0))).toBe(true);
	});

	it("returns true when equal", () => {
		expect(SemVer.lte(v(1, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns false when a > b", () => {
		expect(SemVer.lte(v(2, 0, 0), v(1, 0, 0))).toBe(false);
	});
});

describe("neq", () => {
	it("returns true when versions differ", () => {
		expect(SemVer.neq(v(1, 0, 0), v(2, 0, 0))).toBe(true);
	});

	it("returns false when identical", () => {
		expect(SemVer.neq(v(1, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("returns false when only build differs (Equal ignores build)", () => {
		expect(SemVer.neq(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(false);
	});
});

describe("isPrerelease", () => {
	it("returns true when prerelease is non-empty", () => {
		expect(SemVer.isPrerelease(v(1, 0, 0, ["alpha"]))).toBe(true);
	});

	it("returns false when no prerelease", () => {
		expect(SemVer.isPrerelease(v(1, 0, 0))).toBe(false);
	});
});

describe("isStable", () => {
	it("returns true when no prerelease", () => {
		expect(SemVer.isStable(v(1, 0, 0))).toBe(true);
	});

	it("returns false when prerelease is non-empty", () => {
		expect(SemVer.isStable(v(1, 0, 0, ["beta"]))).toBe(false);
	});
});

describe("truncate", () => {
	it("strips prerelease and build at 'prerelease' level", () => {
		const result = SemVer.truncate(v(1, 2, 3, ["alpha", 1], ["build"]), "prerelease");
		expect(result.major).toBe(1);
		expect(result.minor).toBe(2);
		expect(result.patch).toBe(3);
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("strips only build at 'build' level", () => {
		const result = SemVer.truncate(v(1, 2, 3, ["alpha", 1], ["build"]), "build");
		expect(result.major).toBe(1);
		expect(result.minor).toBe(2);
		expect(result.patch).toBe(3);
		expect(result.prerelease).toEqual(["alpha", 1]);
		expect(result.build).toEqual([]);
	});

	it("works in data-last (pipe) form", () => {
		const result = pipe(v(1, 0, 0, ["rc", 1], ["20230101"]), SemVer.truncate("prerelease"));
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});
});

describe("sort", () => {
	it("returns versions in ascending order", () => {
		const versions = [v(3, 0, 0), v(1, 0, 0), v(2, 0, 0)];
		const result = SemVer.sort(versions);
		expect(result.map(String)).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
	});

	it("does not mutate the original array", () => {
		const versions = [v(3, 0, 0), v(1, 0, 0)];
		SemVer.sort(versions);
		expect(versions[0].major).toBe(3);
	});

	it("handles prerelease ordering", () => {
		const versions = [v(1, 0, 0), v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["beta"])];
		const result = SemVer.sort(versions);
		expect(result.map(String)).toEqual(["1.0.0-alpha", "1.0.0-beta", "1.0.0"]);
	});
});

describe("rsort", () => {
	it("returns versions in descending order", () => {
		const versions = [v(1, 0, 0), v(3, 0, 0), v(2, 0, 0)];
		const result = SemVer.rsort(versions);
		expect(result.map(String)).toEqual(["3.0.0", "2.0.0", "1.0.0"]);
	});

	it("does not mutate the original array", () => {
		const versions = [v(1, 0, 0), v(3, 0, 0)];
		SemVer.rsort(versions);
		expect(versions[0].major).toBe(1);
	});
});

describe("max", () => {
	it("returns Option.some with the highest version", () => {
		const result = SemVer.max([v(1, 0, 0), v(3, 0, 0), v(2, 0, 0)]);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("3.0.0");
	});

	it("returns Option.none for empty array", () => {
		expect(Option.isNone(SemVer.max([]))).toBe(true);
	});

	it("handles prerelease versions", () => {
		const result = SemVer.max([v(1, 0, 0, ["alpha"]), v(1, 0, 0)]);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0");
	});
});

describe("min", () => {
	it("returns Option.some with the lowest version", () => {
		const result = SemVer.min([v(3, 0, 0), v(1, 0, 0), v(2, 0, 0)]);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0");
	});

	it("returns Option.none for empty array", () => {
		expect(Option.isNone(SemVer.min([]))).toBe(true);
	});

	it("handles prerelease versions", () => {
		const result = SemVer.min([v(1, 0, 0, ["alpha"]), v(1, 0, 0)]);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0-alpha");
	});
});

describe("compareWithBuild", () => {
	it("1.0.0 < 1.0.0+build (no build < has build)", () => {
		expect(SemVer.compareWithBuild(v(1, 0, 0), v(1, 0, 0, [], ["build"]))).toBe(-1);
	});

	it("1.0.0+a < 1.0.0+b (lexicographic build)", () => {
		expect(SemVer.compareWithBuild(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(-1);
	});

	it("falls back to standard comparison when versions differ", () => {
		expect(SemVer.compareWithBuild(v(1, 0, 0), v(2, 0, 0))).toBe(-1);
	});

	it("works in data-last (pipe) form", () => {
		expect(pipe(v(1, 0, 0), SemVer.compareWithBuild(v(1, 0, 0, [], ["build"])))).toBe(-1);
	});
});
