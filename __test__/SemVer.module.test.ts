import { Effect, Equal, Option, Schema, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as SemVer from "../src/SemVer.js";

describe("SemVer module", () => {
	// -----------------------------------------------------------------------
	// make
	// -----------------------------------------------------------------------

	describe("make", () => {
		it("creates a SemVer from major, minor, patch", () => {
			const v = SemVer.make(1, 2, 3);
			expect(v.major).toBe(1);
			expect(v.minor).toBe(2);
			expect(v.patch).toBe(3);
			expect(v.prerelease).toEqual([]);
			expect(v.build).toEqual([]);
			expect(v.toString()).toBe("1.2.3");
		});

		it("creates a SemVer with prerelease and build", () => {
			const v = SemVer.make(1, 0, 0, ["alpha", 1], ["build"]);
			expect(v.major).toBe(1);
			expect(v.prerelease).toEqual(["alpha", 1]);
			expect(v.build).toEqual(["build"]);
			expect(v.toString()).toBe("1.0.0-alpha.1+build");
		});
	});

	// -----------------------------------------------------------------------
	// ZERO
	// -----------------------------------------------------------------------

	describe("ZERO", () => {
		it("is 0.0.0", () => {
			expect(SemVer.ZERO.toString()).toBe("0.0.0");
		});

		it("equals make(0, 0, 0)", () => {
			expect(Equal.equals(SemVer.ZERO, SemVer.make(0, 0, 0))).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// fromString
	// -----------------------------------------------------------------------

	describe("fromString", () => {
		it("parses a valid semver string", () => {
			const v = Effect.runSync(SemVer.fromString("1.2.3"));
			expect(v.major).toBe(1);
			expect(v.minor).toBe(2);
			expect(v.patch).toBe(3);
		});
	});

	// -----------------------------------------------------------------------
	// Comparison functions
	// -----------------------------------------------------------------------

	describe("comparison", () => {
		const v1 = SemVer.make(1, 0, 0);
		const v2 = SemVer.make(2, 0, 0);

		it("gt data-first", () => {
			expect(SemVer.gt(v2, v1)).toBe(true);
			expect(SemVer.gt(v1, v2)).toBe(false);
		});

		it("gt data-last (pipe)", () => {
			const result = pipe(v2, SemVer.gt(v1));
			expect(result).toBe(true);
		});

		it("compare returns -1, 0, 1", () => {
			expect(SemVer.compare(v1, v2)).toBe(-1);
			expect(SemVer.compare(v1, v1)).toBe(0);
			expect(SemVer.compare(v2, v1)).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// bump namespace
	// -----------------------------------------------------------------------

	describe("bump", () => {
		const v = SemVer.make(1, 2, 3);

		it("major", () => {
			expect(SemVer.bump.major(v).toString()).toBe("2.0.0");
		});

		it("minor", () => {
			expect(SemVer.bump.minor(v).toString()).toBe("1.3.0");
		});

		it("patch", () => {
			expect(SemVer.bump.patch(v).toString()).toBe("1.2.4");
		});

		it("prerelease", () => {
			const pre = SemVer.bump.prerelease(v, "alpha");
			expect(pre.toString()).toBe("1.2.4-alpha.0");
		});

		it("release", () => {
			const pre = SemVer.make(1, 2, 3, ["rc", 1]);
			expect(SemVer.bump.release(pre).toString()).toBe("1.2.3");
		});
	});

	// -----------------------------------------------------------------------
	// sort / max
	// -----------------------------------------------------------------------

	describe("sort", () => {
		it("sorts versions ascending", () => {
			const versions = [SemVer.make(3, 0, 0), SemVer.make(1, 0, 0), SemVer.make(2, 0, 0)];
			const sorted = SemVer.sort(versions);
			expect(sorted.map((v) => v.toString())).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
		});
	});

	describe("max", () => {
		it("returns the highest version", () => {
			const versions = [SemVer.make(1, 0, 0), SemVer.make(3, 0, 0), SemVer.make(2, 0, 0)];
			const result = SemVer.max(versions);
			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value.toString()).toBe("3.0.0");
			}
		});
	});

	// -----------------------------------------------------------------------
	// diff
	// -----------------------------------------------------------------------

	describe("diff", () => {
		it("computes version diff", () => {
			const a = SemVer.make(1, 0, 0);
			const b = SemVer.make(2, 1, 0);
			const d = SemVer.diff(a, b);
			expect(d.type).toBe("major");
			expect(d.major).toBe(1);
			expect(d.minor).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// isPrerelease
	// -----------------------------------------------------------------------

	describe("isPrerelease", () => {
		it("returns true for prerelease versions", () => {
			expect(SemVer.isPrerelease(SemVer.make(1, 0, 0, ["alpha"]))).toBe(true);
		});

		it("returns false for stable versions", () => {
			expect(SemVer.isPrerelease(SemVer.make(1, 0, 0))).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Equivalence
	// -----------------------------------------------------------------------

	describe("Equivalence", () => {
		it("treats equal versions as equivalent", () => {
			const a = SemVer.make(1, 2, 3);
			const b = SemVer.make(1, 2, 3);
			expect(SemVer.Equivalence(a, b)).toBe(true);
		});

		it("treats different versions as not equivalent", () => {
			const a = SemVer.make(1, 2, 3);
			const b = SemVer.make(1, 2, 4);
			expect(SemVer.Equivalence(a, b)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// FromString schema
	// -----------------------------------------------------------------------

	describe("FromString", () => {
		it("decodes a string to SemVer", () => {
			const v = Schema.decodeUnknownSync(SemVer.FromString)("1.2.3");
			expect(v).toBeInstanceOf(SemVer.SemVer);
			expect(v.toString()).toBe("1.2.3");
		});

		it("encodes a SemVer to string", () => {
			const v = SemVer.make(1, 2, 3);
			const s = Schema.encodeSync(SemVer.FromString)(v);
			expect(s).toBe("1.2.3");
		});

		it("fails on invalid input", () => {
			expect(() => Schema.decodeUnknownSync(SemVer.FromString)("not-a-version")).toThrow();
		});

		it("is usable with Schema.Config", () => {
			// Verify the schema type is compatible with Schema.Config
			const config = Schema.Config("TEST_VERSION", SemVer.FromString);
			expect(config).toBeDefined();
		});
	});
});
