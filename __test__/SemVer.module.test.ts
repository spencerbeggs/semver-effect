import type { Equivalence } from "effect";
import { Effect, Equal, Option, ParseResult, Schema, pipe } from "effect";
import { describe, expect, it } from "vitest";
import { SemVer } from "../src/schemas/SemVer.js";
import { bumpMajor, bumpMinor, bumpPatch, bumpPrerelease, bumpRelease } from "../src/utils/bump.js";
import { compare, gt, isPrerelease, max, sort } from "../src/utils/compare.js";
import { diff } from "../src/utils/diff.js";
import { parseValidSemVer } from "../src/utils/grammar.js";
import { make } from "./utils/make.js";

/** Equivalence that delegates to Effect Equal */
const SemVerEquivalence: Equivalence.Equivalence<SemVer> = (a, b) => Equal.equals(a, b);

/** Schema transform: string <-> SemVer */
const FromString = Schema.transformOrFail(Schema.String, Schema.instanceOf(SemVer), {
	strict: true,
	decode: (s, _, ast) => Effect.mapError(parseValidSemVer(s), (e) => new ParseResult.Type(ast, s, e.message)),
	encode: (v) => Effect.succeed(v.toString()),
});

describe("SemVer module (flat API)", () => {
	// -----------------------------------------------------------------------
	// make
	// -----------------------------------------------------------------------

	describe("make", () => {
		it("creates a SemVer from major, minor, patch", () => {
			const v = make(1, 2, 3);
			expect(v.major).toBe(1);
			expect(v.minor).toBe(2);
			expect(v.patch).toBe(3);
			expect(v.prerelease).toEqual([]);
			expect(v.build).toEqual([]);
			expect(v.toString()).toBe("1.2.3");
		});

		it("creates a SemVer with prerelease and build", () => {
			const v = make(1, 0, 0, ["alpha", 1], ["build"]);
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
		const ZERO = make(0, 0, 0);

		it("is 0.0.0", () => {
			expect(ZERO.toString()).toBe("0.0.0");
		});

		it("equals make(0, 0, 0)", () => {
			expect(Equal.equals(ZERO, make(0, 0, 0))).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// fromString (parseValidSemVer)
	// -----------------------------------------------------------------------

	describe("fromString", () => {
		it("parses a valid semver string", () => {
			const v = Effect.runSync(parseValidSemVer("1.2.3"));
			expect(v.major).toBe(1);
			expect(v.minor).toBe(2);
			expect(v.patch).toBe(3);
		});
	});

	// -----------------------------------------------------------------------
	// Comparison functions
	// -----------------------------------------------------------------------

	describe("comparison", () => {
		const v1 = make(1, 0, 0);
		const v2 = make(2, 0, 0);

		it("gt data-first", () => {
			expect(gt(v2, v1)).toBe(true);
			expect(gt(v1, v2)).toBe(false);
		});

		it("gt data-last (pipe)", () => {
			const result = pipe(v2, gt(v1));
			expect(result).toBe(true);
		});

		it("compare returns -1, 0, 1", () => {
			expect(compare(v1, v2)).toBe(-1);
			expect(compare(v1, v1)).toBe(0);
			expect(compare(v2, v1)).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// bump
	// -----------------------------------------------------------------------

	describe("bump", () => {
		const v = make(1, 2, 3);

		it("major", () => {
			expect(bumpMajor(v).toString()).toBe("2.0.0");
		});

		it("minor", () => {
			expect(bumpMinor(v).toString()).toBe("1.3.0");
		});

		it("patch", () => {
			expect(bumpPatch(v).toString()).toBe("1.2.4");
		});

		it("prerelease", () => {
			const pre = bumpPrerelease(v, "alpha");
			expect(pre.toString()).toBe("1.2.4-alpha.0");
		});

		it("release", () => {
			const pre = make(1, 2, 3, ["rc", 1]);
			expect(bumpRelease(pre).toString()).toBe("1.2.3");
		});
	});

	// -----------------------------------------------------------------------
	// sort / max
	// -----------------------------------------------------------------------

	describe("sort", () => {
		it("sorts versions ascending", () => {
			const versions = [make(3, 0, 0), make(1, 0, 0), make(2, 0, 0)];
			const sorted = sort(versions);
			expect(sorted.map((v) => v.toString())).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
		});
	});

	describe("max", () => {
		it("returns the highest version", () => {
			const versions = [make(1, 0, 0), make(3, 0, 0), make(2, 0, 0)];
			const result = max(versions);
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
			const a = make(1, 0, 0);
			const b = make(2, 1, 0);
			const d = diff(a, b);
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
			expect(isPrerelease(make(1, 0, 0, ["alpha"]))).toBe(true);
		});

		it("returns false for stable versions", () => {
			expect(isPrerelease(make(1, 0, 0))).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Equivalence
	// -----------------------------------------------------------------------

	describe("Equivalence", () => {
		it("treats equal versions as equivalent", () => {
			const a = make(1, 2, 3);
			const b = make(1, 2, 3);
			expect(SemVerEquivalence(a, b)).toBe(true);
		});

		it("treats different versions as not equivalent", () => {
			const a = make(1, 2, 3);
			const b = make(1, 2, 4);
			expect(SemVerEquivalence(a, b)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// FromString schema
	// -----------------------------------------------------------------------

	describe("FromString", () => {
		it("decodes a string to SemVer", () => {
			const v = Schema.decodeUnknownSync(FromString)("1.2.3");
			expect(v).toBeInstanceOf(SemVer);
			expect(v.toString()).toBe("1.2.3");
		});

		it("encodes a SemVer to string", () => {
			const v = make(1, 2, 3);
			const s = Schema.encodeSync(FromString)(v);
			expect(s).toBe("1.2.3");
		});

		it("fails on invalid input", () => {
			expect(() => Schema.decodeUnknownSync(FromString)("not-a-version")).toThrow();
		});

		it("is usable with Schema.Config", () => {
			// Verify the schema type is compatible with Schema.Config
			const config = Schema.Config("TEST_VERSION", FromString);
			expect(config).toBeDefined();
		});
	});
});
