import { Option, pipe } from "effect";
import { describe, expect, it } from "vitest";
import { SemVer } from "../src/schemas/SemVer.js";
import {
	compare,
	compareWithBuild,
	equal,
	gt,
	gte,
	isPrerelease,
	isStable,
	lt,
	lte,
	max,
	min,
	neq,
	rsort,
	sort,
	truncate,
} from "../src/utils/compare.js";

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });

describe("compare", () => {
	it("returns -1 when a < b", () => {
		expect(compare(v(1, 0, 0), v(2, 0, 0))).toBe(-1);
	});

	it("returns 0 when equal", () => {
		expect(compare(v(1, 0, 0), v(1, 0, 0))).toBe(0);
	});

	it("returns 1 when a > b", () => {
		expect(compare(v(2, 0, 0), v(1, 0, 0))).toBe(1);
	});

	it("ignores build metadata", () => {
		expect(compare(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(0);
	});

	it("works in data-last (pipe) form", () => {
		expect(pipe(v(1, 0, 0), compare(v(2, 0, 0)))).toBe(-1);
	});
});

describe("equal", () => {
	it("returns true for identical versions", () => {
		expect(equal(v(1, 2, 3), v(1, 2, 3))).toBe(true);
	});

	it("returns true when only build differs", () => {
		expect(equal(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(true);
	});

	it("returns false when fields differ", () => {
		expect(equal(v(1, 0, 0), v(1, 0, 1))).toBe(false);
	});

	it("returns false when prerelease differs", () => {
		expect(equal(v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["beta"]))).toBe(false);
	});
});

describe("gt", () => {
	it("returns true when a > b", () => {
		expect(gt(v(2, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns false when a < b", () => {
		expect(gt(v(1, 0, 0), v(2, 0, 0))).toBe(false);
	});

	it("returns false when equal", () => {
		expect(gt(v(1, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("1.0.0 > 1.0.0-alpha (release > prerelease)", () => {
		expect(gt(v(1, 0, 0), v(1, 0, 0, ["alpha"]))).toBe(true);
	});
});

describe("gte", () => {
	it("returns true when a > b", () => {
		expect(gte(v(2, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns true when equal", () => {
		expect(gte(v(1, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns false when a < b", () => {
		expect(gte(v(1, 0, 0), v(2, 0, 0))).toBe(false);
	});
});

describe("lt", () => {
	it("returns true when a < b", () => {
		expect(lt(v(1, 0, 0), v(2, 0, 0))).toBe(true);
	});

	it("returns false when a > b", () => {
		expect(lt(v(2, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("returns false when equal", () => {
		expect(lt(v(1, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("1.0.0-alpha < 1.0.0 (prerelease < release)", () => {
		expect(lt(v(1, 0, 0, ["alpha"]), v(1, 0, 0))).toBe(true);
	});
});

describe("lte", () => {
	it("returns true when a < b", () => {
		expect(lte(v(1, 0, 0), v(2, 0, 0))).toBe(true);
	});

	it("returns true when equal", () => {
		expect(lte(v(1, 0, 0), v(1, 0, 0))).toBe(true);
	});

	it("returns false when a > b", () => {
		expect(lte(v(2, 0, 0), v(1, 0, 0))).toBe(false);
	});
});

describe("neq", () => {
	it("returns true when versions differ", () => {
		expect(neq(v(1, 0, 0), v(2, 0, 0))).toBe(true);
	});

	it("returns false when identical", () => {
		expect(neq(v(1, 0, 0), v(1, 0, 0))).toBe(false);
	});

	it("returns false when only build differs (Equal ignores build)", () => {
		expect(neq(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(false);
	});
});

describe("isPrerelease", () => {
	it("returns true when prerelease is non-empty", () => {
		expect(isPrerelease(v(1, 0, 0, ["alpha"]))).toBe(true);
	});

	it("returns false when no prerelease", () => {
		expect(isPrerelease(v(1, 0, 0))).toBe(false);
	});
});

describe("isStable", () => {
	it("returns true when no prerelease", () => {
		expect(isStable(v(1, 0, 0))).toBe(true);
	});

	it("returns false when prerelease is non-empty", () => {
		expect(isStable(v(1, 0, 0, ["beta"]))).toBe(false);
	});
});

describe("truncate", () => {
	it("strips prerelease and build at 'prerelease' level", () => {
		const result = truncate(v(1, 2, 3, ["alpha", 1], ["build"]), "prerelease");
		expect(result.major).toBe(1);
		expect(result.minor).toBe(2);
		expect(result.patch).toBe(3);
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("strips only build at 'build' level", () => {
		const result = truncate(v(1, 2, 3, ["alpha", 1], ["build"]), "build");
		expect(result.major).toBe(1);
		expect(result.minor).toBe(2);
		expect(result.patch).toBe(3);
		expect(result.prerelease).toEqual(["alpha", 1]);
		expect(result.build).toEqual([]);
	});

	it("works in data-last (pipe) form", () => {
		const result = pipe(v(1, 0, 0, ["rc", 1], ["20230101"]), truncate("prerelease"));
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});
});

describe("sort", () => {
	it("returns versions in ascending order", () => {
		const versions = [v(3, 0, 0), v(1, 0, 0), v(2, 0, 0)];
		const result = sort(versions);
		expect(result.map(String)).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
	});

	it("does not mutate the original array", () => {
		const versions = [v(3, 0, 0), v(1, 0, 0)];
		sort(versions);
		expect(versions[0].major).toBe(3);
	});

	it("handles prerelease ordering", () => {
		const versions = [v(1, 0, 0), v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["beta"])];
		const result = sort(versions);
		expect(result.map(String)).toEqual(["1.0.0-alpha", "1.0.0-beta", "1.0.0"]);
	});
});

describe("rsort", () => {
	it("returns versions in descending order", () => {
		const versions = [v(1, 0, 0), v(3, 0, 0), v(2, 0, 0)];
		const result = rsort(versions);
		expect(result.map(String)).toEqual(["3.0.0", "2.0.0", "1.0.0"]);
	});

	it("does not mutate the original array", () => {
		const versions = [v(1, 0, 0), v(3, 0, 0)];
		rsort(versions);
		expect(versions[0].major).toBe(1);
	});
});

describe("max", () => {
	it("returns Option.some with the highest version", () => {
		const result = max([v(1, 0, 0), v(3, 0, 0), v(2, 0, 0)]);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("3.0.0");
	});

	it("returns Option.none for empty array", () => {
		expect(Option.isNone(max([]))).toBe(true);
	});

	it("handles prerelease versions", () => {
		const result = max([v(1, 0, 0, ["alpha"]), v(1, 0, 0)]);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0");
	});
});

describe("min", () => {
	it("returns Option.some with the lowest version", () => {
		const result = min([v(3, 0, 0), v(1, 0, 0), v(2, 0, 0)]);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0");
	});

	it("returns Option.none for empty array", () => {
		expect(Option.isNone(min([]))).toBe(true);
	});

	it("handles prerelease versions", () => {
		const result = min([v(1, 0, 0, ["alpha"]), v(1, 0, 0)]);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0-alpha");
	});
});

describe("compareWithBuild", () => {
	it("1.0.0 < 1.0.0+build (no build < has build)", () => {
		expect(compareWithBuild(v(1, 0, 0), v(1, 0, 0, [], ["build"]))).toBe(-1);
	});

	it("1.0.0+a < 1.0.0+b (lexicographic build)", () => {
		expect(compareWithBuild(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(-1);
	});

	it("falls back to standard comparison when versions differ", () => {
		expect(compareWithBuild(v(1, 0, 0), v(2, 0, 0))).toBe(-1);
	});

	it("works in data-last (pipe) form", () => {
		expect(pipe(v(1, 0, 0), compareWithBuild(v(1, 0, 0, [], ["build"])))).toBe(-1);
	});
});
