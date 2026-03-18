import { Effect, Option, ParseResult, Schema, pipe } from "effect";
import { describe, expect, it } from "vitest";
import { Comparator } from "../src/schemas/Comparator.js";
import { Range } from "../src/schemas/Range.js";
import { intersect, simplify, union } from "../src/utils/algebra.js";
import { filter, maxSatisfying, satisfies } from "../src/utils/matching.js";
import { parseRange } from "../src/utils/parseRange.js";
import { make } from "./utils/make.js";

/** Construct >=0.0.0 (matches all stable versions) */
const anyRange = new Range({
	sets: [[new Comparator({ operator: ">=", version: make(0, 0, 0) })]],
});

/** Schema transform: string <-> Range */
const FromString = Schema.transformOrFail(Schema.String, Schema.instanceOf(Range), {
	strict: true,
	decode: (s, _, ast) => Effect.mapError(parseRange(s), (e) => new ParseResult.Type(ast, s, e.message)),
	encode: (r) => Effect.succeed(r.toString()),
});

describe("Range module (flat API)", () => {
	// -----------------------------------------------------------------------
	// fromString (parseRange)
	// -----------------------------------------------------------------------

	describe("fromString", () => {
		it("parses a valid range string", () => {
			const r = Effect.runSync(parseRange("^1.0.0"));
			expect(r).toBeInstanceOf(Range);
			expect(r.toString()).toContain(">=1.0.0");
		});
	});

	// -----------------------------------------------------------------------
	// any
	// -----------------------------------------------------------------------

	describe("any", () => {
		it("matches all stable versions", () => {
			const versions = [make(0, 0, 1), make(1, 0, 0), make(999, 999, 999)];
			for (const v of versions) {
				expect(satisfies(v, anyRange)).toBe(true);
			}
		});

		it("is a Range instance", () => {
			expect(anyRange).toBeInstanceOf(Range);
		});
	});

	// -----------------------------------------------------------------------
	// union
	// -----------------------------------------------------------------------

	describe("union", () => {
		it("combines two ranges with OR semantics", () => {
			const a = Effect.runSync(parseRange("^1.0.0"));
			const b = Effect.runSync(parseRange("^2.0.0"));
			const combined = union(a, b);
			expect(satisfies(make(1, 5, 0), combined)).toBe(true);
			expect(satisfies(make(2, 5, 0), combined)).toBe(true);
			expect(satisfies(make(3, 0, 0), combined)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// intersect
	// -----------------------------------------------------------------------

	describe("intersect", () => {
		it("computes the intersection of two ranges", () => {
			const a = Effect.runSync(parseRange(">=1.0.0"));
			const b = Effect.runSync(parseRange("<2.0.0"));
			const result = Effect.runSync(intersect(a, b));
			expect(satisfies(make(1, 5, 0), result)).toBe(true);
			expect(satisfies(make(2, 5, 0), result)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// simplify
	// -----------------------------------------------------------------------

	describe("simplify", () => {
		it("removes redundant comparator sets", () => {
			const a = Effect.runSync(parseRange(">=1.0.0"));
			const b = Effect.runSync(parseRange(">=1.0.0 <2.0.0"));
			const combined = union(a, b);
			const simplified = simplify(combined);
			// The broader set (>=1.0.0) should subsume the narrower one
			expect(simplified.sets.length).toBeLessThanOrEqual(combined.sets.length);
		});
	});

	// -----------------------------------------------------------------------
	// satisfies
	// -----------------------------------------------------------------------

	describe("satisfies", () => {
		const range = Effect.runSync(parseRange("^1.0.0"));

		it("data-first", () => {
			expect(satisfies(make(1, 5, 0), range)).toBe(true);
			expect(satisfies(make(2, 0, 0), range)).toBe(false);
		});

		it("data-last (pipe)", () => {
			const result = pipe(make(1, 5, 0), satisfies(range));
			expect(result).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// filter
	// -----------------------------------------------------------------------

	describe("filter", () => {
		it("filters versions by range", () => {
			const range = Effect.runSync(parseRange("^1.0.0"));
			const versions = [make(0, 9, 0), make(1, 0, 0), make(1, 5, 0), make(2, 0, 0)];
			const result = filter(versions, range);
			expect(result.map((v) => v.toString())).toEqual(["1.0.0", "1.5.0"]);
		});
	});

	// -----------------------------------------------------------------------
	// maxSatisfying
	// -----------------------------------------------------------------------

	describe("maxSatisfying", () => {
		it("returns the highest satisfying version", () => {
			const range = Effect.runSync(parseRange("^1.0.0"));
			const versions = [make(1, 0, 0), make(1, 5, 0), make(2, 0, 0)];
			const result = maxSatisfying(versions, range);
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
			const r = Schema.decodeUnknownSync(FromString)("^1.0.0");
			expect(r).toBeInstanceOf(Range);
		});

		it("encodes a Range to string", () => {
			const r = Effect.runSync(parseRange(">=1.0.0 <2.0.0"));
			const s = Schema.encodeSync(FromString)(r);
			expect(typeof s).toBe("string");
			expect(s).toContain(">=1.0.0");
		});

		it("fails on invalid input", () => {
			expect(() => Schema.decodeUnknownSync(FromString)("totally invalid %%% range")).toThrow();
		});
	});
});
