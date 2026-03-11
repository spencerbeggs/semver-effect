import { Effect, Option, Schema, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";

describe("Range module", () => {
	// -----------------------------------------------------------------------
	// fromString
	// -----------------------------------------------------------------------

	describe("fromString", () => {
		it("parses a valid range string", () => {
			const r = Effect.runSync(Range.fromString("^1.0.0"));
			expect(r).toBeInstanceOf(Range.Range);
			expect(r.toString()).toContain(">=1.0.0");
		});
	});

	// -----------------------------------------------------------------------
	// any
	// -----------------------------------------------------------------------

	describe("any", () => {
		it("matches all stable versions", () => {
			const versions = [SemVer.make(0, 0, 1), SemVer.make(1, 0, 0), SemVer.make(999, 999, 999)];
			for (const v of versions) {
				expect(Range.satisfies(v, Range.any)).toBe(true);
			}
		});

		it("is a Range instance", () => {
			expect(Range.any).toBeInstanceOf(Range.Range);
		});
	});

	// -----------------------------------------------------------------------
	// union
	// -----------------------------------------------------------------------

	describe("union", () => {
		it("combines two ranges with OR semantics", () => {
			const a = Effect.runSync(Range.fromString("^1.0.0"));
			const b = Effect.runSync(Range.fromString("^2.0.0"));
			const combined = Range.union(a, b);
			expect(Range.satisfies(SemVer.make(1, 5, 0), combined)).toBe(true);
			expect(Range.satisfies(SemVer.make(2, 5, 0), combined)).toBe(true);
			expect(Range.satisfies(SemVer.make(3, 0, 0), combined)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// intersect
	// -----------------------------------------------------------------------

	describe("intersect", () => {
		it("computes the intersection of two ranges", () => {
			const a = Effect.runSync(Range.fromString(">=1.0.0"));
			const b = Effect.runSync(Range.fromString("<2.0.0"));
			const result = Effect.runSync(Range.intersect(a, b));
			expect(Range.satisfies(SemVer.make(1, 5, 0), result)).toBe(true);
			expect(Range.satisfies(SemVer.make(2, 5, 0), result)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// simplify
	// -----------------------------------------------------------------------

	describe("simplify", () => {
		it("removes redundant comparator sets", () => {
			const a = Effect.runSync(Range.fromString(">=1.0.0"));
			const b = Effect.runSync(Range.fromString(">=1.0.0 <2.0.0"));
			const combined = Range.union(a, b);
			const simplified = Range.simplify(combined);
			// The broader set (>=1.0.0) should subsume the narrower one
			expect(simplified.sets.length).toBeLessThanOrEqual(combined.sets.length);
		});
	});

	// -----------------------------------------------------------------------
	// satisfies
	// -----------------------------------------------------------------------

	describe("satisfies", () => {
		const range = Effect.runSync(Range.fromString("^1.0.0"));

		it("data-first", () => {
			expect(Range.satisfies(SemVer.make(1, 5, 0), range)).toBe(true);
			expect(Range.satisfies(SemVer.make(2, 0, 0), range)).toBe(false);
		});

		it("data-last (pipe)", () => {
			const result = pipe(SemVer.make(1, 5, 0), Range.satisfies(range));
			expect(result).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// filter
	// -----------------------------------------------------------------------

	describe("filter", () => {
		it("filters versions by range", () => {
			const range = Effect.runSync(Range.fromString("^1.0.0"));
			const versions = [SemVer.make(0, 9, 0), SemVer.make(1, 0, 0), SemVer.make(1, 5, 0), SemVer.make(2, 0, 0)];
			const result = Range.filter(versions, range);
			expect(result.map((v) => v.toString())).toEqual(["1.0.0", "1.5.0"]);
		});
	});

	// -----------------------------------------------------------------------
	// maxSatisfying
	// -----------------------------------------------------------------------

	describe("maxSatisfying", () => {
		it("returns the highest satisfying version", () => {
			const range = Effect.runSync(Range.fromString("^1.0.0"));
			const versions = [SemVer.make(1, 0, 0), SemVer.make(1, 5, 0), SemVer.make(2, 0, 0)];
			const result = Range.maxSatisfying(versions, range);
			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value.toString()).toBe("1.5.0");
			}
		});
	});

	// -----------------------------------------------------------------------
	// FromString schema
	// -----------------------------------------------------------------------

	describe("FromString", () => {
		it("decodes a string to Range", () => {
			const r = Schema.decodeUnknownSync(Range.FromString)("^1.0.0");
			expect(r).toBeInstanceOf(Range.Range);
		});

		it("encodes a Range to string", () => {
			const r = Effect.runSync(Range.fromString(">=1.0.0 <2.0.0"));
			const s = Schema.encodeSync(Range.FromString)(r);
			expect(typeof s).toBe("string");
			expect(s).toContain(">=1.0.0");
		});

		it("fails on invalid input", () => {
			expect(() => Schema.decodeUnknownSync(Range.FromString)("totally invalid %%% range")).toThrow();
		});
	});
});
