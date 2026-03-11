import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Comparator from "../src/Comparator.js";

describe("Comparator module", () => {
	// -----------------------------------------------------------------------
	// fromString
	// -----------------------------------------------------------------------

	describe("fromString", () => {
		it("parses a comparator string", () => {
			const c = Effect.runSync(Comparator.fromString(">=1.2.3"));
			expect(c).toBeInstanceOf(Comparator.Comparator);
			expect(c.operator).toBe(">=");
			expect(c.version.major).toBe(1);
			expect(c.version.minor).toBe(2);
			expect(c.version.patch).toBe(3);
			expect(c.toString()).toBe(">=1.2.3");
		});

		it("parses bare version as = operator", () => {
			const c = Effect.runSync(Comparator.fromString("1.0.0"));
			expect(c.operator).toBe("=");
			expect(c.toString()).toBe("1.0.0");
		});
	});

	// -----------------------------------------------------------------------
	// any
	// -----------------------------------------------------------------------

	describe("any", () => {
		it("is >=0.0.0", () => {
			expect(Comparator.any).toBeInstanceOf(Comparator.Comparator);
			expect(Comparator.any.operator).toBe(">=");
			expect(Comparator.any.version.major).toBe(0);
			expect(Comparator.any.version.minor).toBe(0);
			expect(Comparator.any.version.patch).toBe(0);
			expect(Comparator.any.toString()).toBe(">=0.0.0");
		});
	});

	// -----------------------------------------------------------------------
	// FromString schema
	// -----------------------------------------------------------------------

	describe("FromString", () => {
		it("decodes a string to Comparator", () => {
			const c = Schema.decodeUnknownSync(Comparator.FromString)(">=1.2.3");
			expect(c).toBeInstanceOf(Comparator.Comparator);
			expect(c.operator).toBe(">=");
			expect(c.version.major).toBe(1);
			expect(c.toString()).toBe(">=1.2.3");
		});

		it("encodes a Comparator to string", () => {
			const c = Effect.runSync(Comparator.fromString("<2.0.0"));
			const s = Schema.encodeSync(Comparator.FromString)(c);
			expect(s).toBe("<2.0.0");
		});

		it("fails on invalid input", () => {
			expect(() => Schema.decodeUnknownSync(Comparator.FromString)("not-valid")).toThrow();
		});
	});
});
