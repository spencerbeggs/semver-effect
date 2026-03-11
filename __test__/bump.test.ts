import { describe, expect, it } from "vitest";
import * as SemVer from "../src/SemVer.js";

const v = SemVer.make;

describe("bumpMajor", () => {
	it("1.2.3-alpha+build -> 2.0.0 (clears pre, build, zeroes minor+patch)", () => {
		const result = SemVer.bump.major(v(1, 2, 3, ["alpha"], ["build"]));
		expect(result.toString()).toBe("2.0.0");
		expect(result.major).toBe(2);
		expect(result.minor).toBe(0);
		expect(result.patch).toBe(0);
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("0.1.0 -> 1.0.0", () => {
		const result = SemVer.bump.major(v(0, 1, 0));
		expect(result.toString()).toBe("1.0.0");
	});
});

describe("bumpMinor", () => {
	it("1.2.3-alpha -> 1.3.0 (clears prerelease, zeroes patch)", () => {
		const result = SemVer.bump.minor(v(1, 2, 3, ["alpha"]));
		expect(result.toString()).toBe("1.3.0");
		expect(result.minor).toBe(3);
		expect(result.patch).toBe(0);
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("1.0.0 -> 1.1.0", () => {
		const result = SemVer.bump.minor(v(1, 0, 0));
		expect(result.toString()).toBe("1.1.0");
	});
});

describe("bumpPatch", () => {
	it("1.2.3-alpha -> 1.2.4 (clears prerelease)", () => {
		const result = SemVer.bump.patch(v(1, 2, 3, ["alpha"]));
		expect(result.toString()).toBe("1.2.4");
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("1.2.3 -> 1.2.4", () => {
		const result = SemVer.bump.patch(v(1, 2, 3));
		expect(result.toString()).toBe("1.2.4");
	});
});

describe("bumpPrerelease", () => {
	it("1.0.0 with no id -> 1.0.1-0", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0));
		expect(result.toString()).toBe("1.0.1-0");
		expect(result.patch).toBe(1);
		expect(result.prerelease).toEqual([0]);
	});

	it("1.0.0-alpha.1 with no id -> 1.0.0-alpha.2", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha", 1]));
		expect(result.toString()).toBe("1.0.0-alpha.2");
		expect(result.prerelease).toEqual(["alpha", 2]);
	});

	it("1.0.0-alpha with no id (ends in string) -> 1.0.0-alpha.0", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha"]));
		expect(result.toString()).toBe("1.0.0-alpha.0");
		expect(result.prerelease).toEqual(["alpha", 0]);
	});

	it("1.0.0-alpha.1 with id 'beta' -> 1.0.0-beta.0", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha", 1]), "beta");
		expect(result.toString()).toBe("1.0.0-beta.0");
		expect(result.prerelease).toEqual(["beta", 0]);
	});

	it("1.0.0-alpha.1 with id 'alpha' -> 1.0.0-alpha.2 (same prefix)", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha", 1]), "alpha");
		expect(result.toString()).toBe("1.0.0-alpha.2");
		expect(result.prerelease).toEqual(["alpha", 2]);
	});
});

describe("bumpRelease", () => {
	it("1.2.3-alpha.1+build -> 1.2.3", () => {
		const result = SemVer.bump.release(v(1, 2, 3, ["alpha", 1], ["build"]));
		expect(result.toString()).toBe("1.2.3");
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});

	it("1.2.3 -> 1.2.3 (already release, no-op)", () => {
		const result = SemVer.bump.release(v(1, 2, 3));
		expect(result.toString()).toBe("1.2.3");
		expect(result.prerelease).toEqual([]);
		expect(result.build).toEqual([]);
	});
});
