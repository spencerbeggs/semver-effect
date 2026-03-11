import { Effect, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";

const r = (input: string) => Effect.runSync(Range.fromString(input));

const v = SemVer.make;

describe("union", () => {
	it("union of two disjoint ranges contains both sets", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=3.0.0 <4.0.0");
		const result = Range.union(a, b);
		expect(result.sets.length).toBe(a.sets.length + b.sets.length);
	});

	it("union preserves all sets from both ranges", () => {
		const a = r(">=1.0.0 <2.0.0 || >=5.0.0 <6.0.0");
		const b = r(">=3.0.0 <4.0.0");
		const result = Range.union(a, b);
		expect(result.sets.length).toBe(3);
		// Versions from all ranges should satisfy the union
		expect(Range.satisfies(v(1, 5, 0), result)).toBe(true);
		expect(Range.satisfies(v(3, 5, 0), result)).toBe(true);
		expect(Range.satisfies(v(5, 5, 0), result)).toBe(true);
		// Outside all ranges
		expect(Range.satisfies(v(2, 5, 0), result)).toBe(false);
	});
});

describe("intersect", () => {
	it("overlapping ranges produce a satisfiable intersection", () => {
		const a = r(">=1.0.0 <3.0.0");
		const b = r(">=2.0.0 <4.0.0");
		const result = Effect.runSync(Range.intersect(a, b));
		// 2.5.0 is in both ranges
		expect(Range.satisfies(v(2, 5, 0), result)).toBe(true);
		// 1.0.0 is in a but not b
		expect(Range.satisfies(v(1, 0, 0), result)).toBe(false);
		// 3.5.0 is in b but not a
		expect(Range.satisfies(v(3, 5, 0), result)).toBe(false);
	});

	it("disjoint ranges fail with UnsatisfiableConstraintError", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=3.0.0 <4.0.0");
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow(/No version satisfies/);
	});

	it("nested ranges produce tighter bounds", () => {
		const a = r(">=1.0.0 <3.0.0");
		const b = r(">=1.5.0 <2.5.0");
		const result = Effect.runSync(Range.intersect(a, b));
		expect(Range.satisfies(v(1, 5, 0), result)).toBe(true);
		expect(Range.satisfies(v(2, 0, 0), result)).toBe(true);
		// Outside the tighter range
		expect(Range.satisfies(v(1, 0, 0), result)).toBe(false);
		expect(Range.satisfies(v(2, 5, 0), result)).toBe(false);
	});
});

describe("isSubset", () => {
	it("narrower range is subset of wider range", () => {
		const sub = r(">=1.0.0 <2.0.0");
		const sup = r(">=0.0.0 <3.0.0");
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	it("wider range is NOT subset of narrower range", () => {
		const wide = r(">=1.0.0 <3.0.0");
		const narrow = r(">=1.5.0 <2.0.0");
		expect(Range.isSubset(wide, narrow)).toBe(false);
	});

	it("same range is subset of itself", () => {
		const range = r(">=1.0.0 <2.0.0");
		expect(Range.isSubset(range, range)).toBe(true);
	});
});

describe("equivalent", () => {
	it("same range is equivalent to itself", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=1.0.0 <2.0.0");
		expect(Range.equivalent(a, b)).toBe(true);
	});

	it("different ranges are not equivalent", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=1.0.0 <3.0.0");
		expect(Range.equivalent(a, b)).toBe(false);
	});
});

describe("simplify", () => {
	it("already minimal range is unchanged", () => {
		const range = r(">=1.0.0 <2.0.0");
		const result = Range.simplify(range);
		expect(result.sets.length).toBe(range.sets.length);
	});

	it("range with multiple non-redundant sets stays the same", () => {
		const range = r(">=1.0.0 <2.0.0 || >=3.0.0 <4.0.0");
		const result = Range.simplify(range);
		expect(result.sets.length).toBe(2);
	});

	it("removes the narrower set when a wider set exists", () => {
		const range = r(">=0.0.0 || >=1.0.0 <2.0.0");
		const result = Range.simplify(range);
		// >=0.0.0 is wider and subsumes >=1.0.0 <2.0.0, so only 1 set remains
		expect(result.sets.length).toBe(1);
		// The surviving set should match all versions (>=0.0.0)
		expect(Range.satisfies(v(0, 0, 0), result)).toBe(true);
		expect(Range.satisfies(v(5, 0, 0), result)).toBe(true);
	});
});

describe("dual API", () => {
	it("pipe(a, union(b)) works (data-last)", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=3.0.0 <4.0.0");
		const result = pipe(a, Range.union(b));
		expect(result.sets.length).toBe(2);
		expect(Range.satisfies(v(1, 5, 0), result)).toBe(true);
		expect(Range.satisfies(v(3, 5, 0), result)).toBe(true);
	});

	it("pipe(a, intersect(b)) works (data-last)", () => {
		const a = r(">=1.0.0 <3.0.0");
		const b = r(">=2.0.0 <4.0.0");
		const result = Effect.runSync(pipe(a, Range.intersect(b)));
		expect(Range.satisfies(v(2, 5, 0), result)).toBe(true);
		expect(Range.satisfies(v(1, 0, 0), result)).toBe(false);
	});

	it("pipe(sub, isSubset(sup)) works (data-last)", () => {
		const sub = r(">=1.0.0 <2.0.0");
		const sup = r(">=0.0.0 <3.0.0");
		expect(pipe(sub, Range.isSubset(sup))).toBe(true);
	});

	it("pipe(a, equivalent(b)) works (data-last)", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=1.0.0 <2.0.0");
		expect(pipe(a, Range.equivalent(b))).toBe(true);
	});
});
