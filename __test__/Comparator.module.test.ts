import { Effect, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Comparator } from "../src/schemas/Comparator.js";
import { parseSingleComparator } from "../src/utils/grammar.js";
import { make } from "./utils/make.js";

/** Construct >=0.0.0 (the "any" comparator) */
const anyComparator = new Comparator({ operator: ">=", version: make(0, 0, 0) });

/** Schema transform: string <-> Comparator */
const FromString = Schema.transformOrFail(Schema.String, Schema.instanceOf(Comparator), {
	strict: true,
	decode: (s, _, ast) => Effect.mapError(parseSingleComparator(s), (e) => new ParseResult.Type(ast, s, e.message)),
	encode: (c) => Effect.succeed(c.toString()),
});

describe("Comparator module (flat API)", () => {
	// -----------------------------------------------------------------------
	// fromString (parseSingleComparator)
	// -----------------------------------------------------------------------

	describe("fromString", () => {
		it("parses a comparator string", () => {
			const c = Effect.runSync(parseSingleComparator(">=1.2.3"));
			expect(c).toBeInstanceOf(Comparator);
			expect(c.operator).toBe(">=");
			expect(c.version.major).toBe(1);
			expect(c.version.minor).toBe(2);
			expect(c.version.patch).toBe(3);
			expect(c.toString()).toBe(">=1.2.3");
		});

		it("parses bare version as = operator", () => {
			const c = Effect.runSync(parseSingleComparator("1.0.0"));
			expect(c.operator).toBe("=");
			expect(c.toString()).toBe("1.0.0");
		});
	});

	// -----------------------------------------------------------------------
	// any
	// -----------------------------------------------------------------------

	describe("any", () => {
		it("is >=0.0.0", () => {
			expect(anyComparator).toBeInstanceOf(Comparator);
			expect(anyComparator.operator).toBe(">=");
			expect(anyComparator.version.major).toBe(0);
			expect(anyComparator.version.minor).toBe(0);
			expect(anyComparator.version.patch).toBe(0);
			expect(anyComparator.toString()).toBe(">=0.0.0");
		});
	});

	// -----------------------------------------------------------------------
	// FromString schema
	// -----------------------------------------------------------------------

	describe("FromString", () => {
		it("decodes a string to Comparator", () => {
			const c = Schema.decodeUnknownSync(FromString)(">=1.2.3");
			expect(c).toBeInstanceOf(Comparator);
			expect(c.operator).toBe(">=");
			expect(c.version.major).toBe(1);
			expect(c.toString()).toBe(">=1.2.3");
		});

		it("encodes a Comparator to string", () => {
			const c = Effect.runSync(parseSingleComparator("<2.0.0"));
			const s = Schema.encodeSync(FromString)(c);
			expect(s).toBe("<2.0.0");
		});

		it("fails on invalid input", () => {
			expect(() => Schema.decodeUnknownSync(FromString)("not-valid")).toThrow();
		});
	});
});
