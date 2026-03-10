import { Equal, Hash } from "effect";
import { describe, expect, it } from "vitest";
import { SemVer } from "../src/schemas/SemVer.js";

describe("SemVer", () => {
	describe("Construction", () => {
		it("creates with all required fields", () => {
			const v = new SemVer({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: ["alpha", 1],
				build: ["build", "001"],
			});
			expect(v.major).toBe(1);
			expect(v.minor).toBe(2);
			expect(v.patch).toBe(3);
			expect(v.prerelease).toEqual(["alpha", 1]);
			expect(v.build).toEqual(["build", "001"]);
		});

		it('has correct _tag of "SemVer"', () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(v._tag).toBe("SemVer");
		});

		it("fields are accessible and readonly", () => {
			const v = new SemVer({
				major: 2,
				minor: 3,
				patch: 4,
				prerelease: ["beta"],
				build: ["meta"],
			});
			expect(v.major).toBe(2);
			expect(v.minor).toBe(3);
			expect(v.patch).toBe(4);
			expect(v.prerelease).toEqual(["beta"]);
			expect(v.build).toEqual(["meta"]);
		});

		it("prerelease defaults to empty array when []", () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(v.prerelease).toEqual([]);
			expect(v.prerelease.length).toBe(0);
		});

		it("build defaults to empty array when []", () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(v.build).toEqual([]);
			expect(v.build.length).toBe(0);
		});
	});

	describe("Equal (ignoring build metadata)", () => {
		it("two identical versions are equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: ["alpha", 1],
				build: ["001"],
			});
			const b = new SemVer({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: ["alpha", 1],
				build: ["001"],
			});
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("versions differing only in build metadata ARE equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: ["build1"],
			});
			const b = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: ["build2"],
			});
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("versions differing in major are NOT equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			const b = new SemVer({
				major: 2,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("versions differing in minor are NOT equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			const b = new SemVer({
				major: 1,
				minor: 1,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("versions differing in patch are NOT equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			const b = new SemVer({
				major: 1,
				minor: 0,
				patch: 1,
				prerelease: [],
				build: [],
			});
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("versions differing in prerelease are NOT equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["alpha"],
				build: [],
			});
			const b = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["beta"],
				build: [],
			});
			expect(Equal.equals(a, b)).toBe(false);
		});

		it('prerelease compared element-wise: ["alpha", 1] === ["alpha", 1]', () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["alpha", 1],
				build: [],
			});
			const b = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["alpha", 1],
				build: [],
			});
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("prerelease with different lengths are NOT equal", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["alpha", 1],
				build: [],
			});
			const b = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["alpha"],
				build: [],
			});
			expect(Equal.equals(a, b)).toBe(false);
		});
	});

	describe("Hash (consistent with Equal)", () => {
		it("same version produces same hash", () => {
			const a = new SemVer({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: ["alpha", 1],
				build: [],
			});
			const b = new SemVer({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: ["alpha", 1],
				build: [],
			});
			expect(Hash.hash(a)).toBe(Hash.hash(b));
		});

		it("versions differing only in build produce SAME hash", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: ["build1"],
			});
			const b = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: ["build2"],
			});
			expect(Hash.hash(a)).toBe(Hash.hash(b));
		});

		it("different versions produce different hashes (probabilistic)", () => {
			const a = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			const b = new SemVer({
				major: 2,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(Hash.hash(a)).not.toBe(Hash.hash(b));
		});
	});

	describe("Inspectable (toString)", () => {
		it('1.0.0 -> "1.0.0"', () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: [],
			});
			expect(v.toString()).toBe("1.0.0");
		});

		it('1.0.0-alpha.1 -> "1.0.0-alpha.1"', () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["alpha", 1],
				build: [],
			});
			expect(v.toString()).toBe("1.0.0-alpha.1");
		});

		it('1.0.0+build.001 -> "1.0.0+build.001"', () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: [],
				build: ["build", "001"],
			});
			expect(v.toString()).toBe("1.0.0+build.001");
		});

		it('1.0.0-rc.1+build -> "1.0.0-rc.1+build"', () => {
			const v = new SemVer({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: ["rc", 1],
				build: ["build"],
			});
			expect(v.toString()).toBe("1.0.0-rc.1+build");
		});
	});

	describe("disableValidation", () => {
		it("can construct with { disableValidation: true } for trusted input", () => {
			const v = new SemVer(
				{
					major: 1,
					minor: 0,
					patch: 0,
					prerelease: [],
					build: [],
				},
				{ disableValidation: true },
			);
			expect(v.major).toBe(1);
			expect(v.minor).toBe(0);
			expect(v.patch).toBe(0);
			expect(v._tag).toBe("SemVer");
		});
	});
});
