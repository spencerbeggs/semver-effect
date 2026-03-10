import { describe, expect, it } from "vitest";
import { SemVerOrder, SemVerOrderWithBuild } from "../src/order.js";
import { SemVer } from "../src/schemas/SemVer.js";

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] }, { disableValidation: true });

describe("SemVerOrder", () => {
	describe("Basic numeric ordering", () => {
		it("1.0.0 < 2.0.0 (major)", () => {
			expect(SemVerOrder(v(1, 0, 0), v(2, 0, 0))).toBe(-1);
		});

		it("1.1.0 < 1.2.0 (minor)", () => {
			expect(SemVerOrder(v(1, 1, 0), v(1, 2, 0))).toBe(-1);
		});

		it("1.0.1 < 1.0.2 (patch)", () => {
			expect(SemVerOrder(v(1, 0, 1), v(1, 0, 2))).toBe(-1);
		});

		it("1.0.0 == 1.0.0 (equal)", () => {
			expect(SemVerOrder(v(1, 0, 0), v(1, 0, 0))).toBe(0);
		});
	});

	describe("Prerelease ordering (spec section 11)", () => {
		it("1.0.0-alpha < 1.0.0 (prerelease < release)", () => {
			expect(SemVerOrder(v(1, 0, 0, ["alpha"]), v(1, 0, 0))).toBe(-1);
		});

		it("1.0.0-alpha < 1.0.0-alpha.1 (shorter < longer)", () => {
			expect(SemVerOrder(v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["alpha", 1]))).toBe(-1);
		});

		it("1.0.0-alpha.1 < 1.0.0-alpha.beta (numeric < alphanumeric)", () => {
			expect(SemVerOrder(v(1, 0, 0, ["alpha", 1]), v(1, 0, 0, ["alpha", "beta"]))).toBe(-1);
		});

		it("1.0.0-alpha.beta < 1.0.0-beta (lexicographic)", () => {
			expect(SemVerOrder(v(1, 0, 0, ["alpha", "beta"]), v(1, 0, 0, ["beta"]))).toBe(-1);
		});

		it("1.0.0-beta < 1.0.0-beta.2 (shorter < longer)", () => {
			expect(SemVerOrder(v(1, 0, 0, ["beta"]), v(1, 0, 0, ["beta", 2]))).toBe(-1);
		});

		it("1.0.0-beta.2 < 1.0.0-beta.11 (numeric comparison, not lexicographic)", () => {
			expect(SemVerOrder(v(1, 0, 0, ["beta", 2]), v(1, 0, 0, ["beta", 11]))).toBe(-1);
		});

		it("1.0.0-beta.11 < 1.0.0-rc.1", () => {
			expect(SemVerOrder(v(1, 0, 0, ["beta", 11]), v(1, 0, 0, ["rc", 1]))).toBe(-1);
		});

		it("1.0.0-rc.1 < 1.0.0", () => {
			expect(SemVerOrder(v(1, 0, 0, ["rc", 1]), v(1, 0, 0))).toBe(-1);
		});
	});

	describe("Build metadata ignored", () => {
		it("Order(1.0.0+a, 1.0.0+b) === 0", () => {
			expect(SemVerOrder(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(0);
		});

		it("Order(1.0.0-alpha+a, 1.0.0-alpha+b) === 0", () => {
			expect(SemVerOrder(v(1, 0, 0, ["alpha"], ["a"]), v(1, 0, 0, ["alpha"], ["b"]))).toBe(0);
		});
	});
});

describe("SemVerOrderWithBuild", () => {
	it("1.0.0 < 1.0.0+build (no build < has build)", () => {
		expect(SemVerOrderWithBuild(v(1, 0, 0), v(1, 0, 0, [], ["build"]))).toBe(-1);
	});

	it("1.0.0+a < 1.0.0+b (lexicographic build comparison)", () => {
		expect(SemVerOrderWithBuild(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]))).toBe(-1);
	});

	it("falls back to standard comparison when versions differ", () => {
		expect(SemVerOrderWithBuild(v(1, 0, 0), v(2, 0, 0))).toBe(-1);
	});
});

describe("Array sorting", () => {
	it("sorts an array of SemVer instances in correct order", () => {
		const versions = [
			v(1, 0, 0, ["rc", 1]),
			v(1, 0, 0),
			v(1, 0, 0, ["alpha"]),
			v(1, 0, 0, ["beta", 11]),
			v(1, 0, 0, ["alpha", 1]),
			v(2, 0, 0),
			v(1, 0, 0, ["beta", 2]),
			v(1, 0, 0, ["alpha", "beta"]),
			v(1, 0, 0, ["beta"]),
		];

		const sorted = versions.slice().sort(SemVerOrder);

		expect(sorted.map(String)).toEqual([
			"1.0.0-alpha",
			"1.0.0-alpha.1",
			"1.0.0-alpha.beta",
			"1.0.0-beta",
			"1.0.0-beta.2",
			"1.0.0-beta.11",
			"1.0.0-rc.1",
			"1.0.0",
			"2.0.0",
		]);
	});
});
