import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";
import { incrementTests } from "./fixtures/increments.js";
import { rangeTests } from "./fixtures/ranges.js";
import { comparisonPairs, invalidVersions, validVersions } from "./fixtures/versions.js";

const parse = (input: string) => Effect.runSync(SemVer.fromString(input));

const r = (input: string) => Effect.runSync(Range.fromString(input));

describe("SemVer 2.0.0 Spec Compliance", () => {
	describe("valid versions", () => {
		it.each(validVersions)("parses %s", (input) => {
			expect(() => parse(input)).not.toThrow();
		});

		it.each(validVersions)("roundtrips %s through toString", (input) => {
			const sv = parse(input);
			// Parse the toString output — should produce equivalent version
			const roundtripped = parse(sv.toString());
			expect(SemVer.Order(sv, roundtripped)).toBe(0);
		});
	});

	describe("invalid versions", () => {
		it.each(invalidVersions)("rejects $input ($reason)", ({ input }) => {
			expect(() => parse(input)).toThrow();
		});
	});

	describe("precedence (Section 11)", () => {
		it.each(comparisonPairs)("%s < %s", (lower, higher) => {
			const a = parse(lower);
			const b = parse(higher);
			expect(SemVer.Order(a, b)).toBeLessThan(0);
		});

		it.each(comparisonPairs)("%s !== %s (not equal)", (lower, higher) => {
			const a = parse(lower);
			const b = parse(higher);
			expect(SemVer.Order(a, b)).not.toBe(0);
		});
	});
});

describe("Range Satisfaction", () => {
	it.each(rangeTests)("satisfies(%s, %s) === %s", (rangeStr, versionStr, expected) => {
		const version = parse(versionStr);
		const range = r(rangeStr);
		expect(Range.satisfies(version, range)).toBe(expected);
	});
});

describe("Increment Operations", () => {
	const bumpFns = {
		major: SemVer.bump.major,
		minor: SemVer.bump.minor,
		patch: SemVer.bump.patch,
	};

	it.each(incrementTests)("bump %s by %s = %s", (initial, operation, expected) => {
		const sv = parse(initial);
		const result = bumpFns[operation](sv);
		expect(result.toString()).toBe(expected);
	});
});
