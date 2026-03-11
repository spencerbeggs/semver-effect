import { Effect, pipe } from "effect";
import { describe, expect, it } from "vitest";
import { SemVer } from "../src/schemas/SemVer.js";
import { equivalent, intersect, isSubset, simplify, union } from "../src/utils/algebra.js";
import { parseRangeSet } from "../src/utils/grammar.js";
import { satisfies } from "../src/utils/matching.js";
import { normalizeRange } from "../src/utils/normalize.js";

const r = (input: string) => Effect.runSync(Effect.map(parseRangeSet(input), normalizeRange));

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });

describe("union", () => {
	it("union of two disjoint ranges contains both sets", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=3.0.0 <4.0.0");
		const result = union(a, b);
		expect(result.sets.length).toBe(a.sets.length + b.sets.length);
	});

	it("union preserves all sets from both ranges", () => {
		const a = r(">=1.0.0 <2.0.0 || >=5.0.0 <6.0.0");
		const b = r(">=3.0.0 <4.0.0");
		const result = union(a, b);
		expect(result.sets.length).toBe(3);
		// Versions from all ranges should satisfy the union
		expect(satisfies(v(1, 5, 0), result)).toBe(true);
		expect(satisfies(v(3, 5, 0), result)).toBe(true);
		expect(satisfies(v(5, 5, 0), result)).toBe(true);
		// Outside all ranges
		expect(satisfies(v(2, 5, 0), result)).toBe(false);
	});
});

describe("intersect", () => {
	it("overlapping ranges produce a satisfiable intersection", () => {
		const a = r(">=1.0.0 <3.0.0");
		const b = r(">=2.0.0 <4.0.0");
		const result = Effect.runSync(intersect(a, b));
		// 2.5.0 is in both ranges
		expect(satisfies(v(2, 5, 0), result)).toBe(true);
		// 1.0.0 is in a but not b
		expect(satisfies(v(1, 0, 0), result)).toBe(false);
		// 3.5.0 is in b but not a
		expect(satisfies(v(3, 5, 0), result)).toBe(false);
	});

	it("disjoint ranges fail with UnsatisfiableConstraintError", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=3.0.0 <4.0.0");
		expect(() => Effect.runSync(intersect(a, b))).toThrow(/No version satisfies/);
	});

	it("nested ranges produce tighter bounds", () => {
		const a = r(">=1.0.0 <3.0.0");
		const b = r(">=1.5.0 <2.5.0");
		const result = Effect.runSync(intersect(a, b));
		expect(satisfies(v(1, 5, 0), result)).toBe(true);
		expect(satisfies(v(2, 0, 0), result)).toBe(true);
		// Outside the tighter range
		expect(satisfies(v(1, 0, 0), result)).toBe(false);
		expect(satisfies(v(2, 5, 0), result)).toBe(false);
	});
});

describe("isSubset", () => {
	it("narrower range is subset of wider range", () => {
		const sub = r(">=1.0.0 <2.0.0");
		const sup = r(">=0.0.0 <3.0.0");
		expect(isSubset(sub, sup)).toBe(true);
	});

	it("wider range is NOT subset of narrower range", () => {
		const wide = r(">=1.0.0 <3.0.0");
		const narrow = r(">=1.5.0 <2.0.0");
		expect(isSubset(wide, narrow)).toBe(false);
	});

	it("same range is subset of itself", () => {
		const range = r(">=1.0.0 <2.0.0");
		expect(isSubset(range, range)).toBe(true);
	});
});

describe("equivalent", () => {
	it("same range is equivalent to itself", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=1.0.0 <2.0.0");
		expect(equivalent(a, b)).toBe(true);
	});

	it("different ranges are not equivalent", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=1.0.0 <3.0.0");
		expect(equivalent(a, b)).toBe(false);
	});
});

describe("simplify", () => {
	it("already minimal range is unchanged", () => {
		const range = r(">=1.0.0 <2.0.0");
		const result = simplify(range);
		expect(result.sets.length).toBe(range.sets.length);
	});

	it("range with multiple non-redundant sets stays the same", () => {
		const range = r(">=1.0.0 <2.0.0 || >=3.0.0 <4.0.0");
		const result = simplify(range);
		expect(result.sets.length).toBe(2);
	});

	it("removes the narrower set when a wider set exists", () => {
		const range = r(">=0.0.0 || >=1.0.0 <2.0.0");
		const result = simplify(range);
		// >=0.0.0 is wider and subsumes >=1.0.0 <2.0.0, so only 1 set remains
		expect(result.sets.length).toBe(1);
		// The surviving set should match all versions (>=0.0.0)
		expect(satisfies(v(0, 0, 0), result)).toBe(true);
		expect(satisfies(v(5, 0, 0), result)).toBe(true);
	});
});

describe("dual API", () => {
	it("pipe(a, union(b)) works (data-last)", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=3.0.0 <4.0.0");
		const result = pipe(a, union(b));
		expect(result.sets.length).toBe(2);
		expect(satisfies(v(1, 5, 0), result)).toBe(true);
		expect(satisfies(v(3, 5, 0), result)).toBe(true);
	});

	it("pipe(a, intersect(b)) works (data-last)", () => {
		const a = r(">=1.0.0 <3.0.0");
		const b = r(">=2.0.0 <4.0.0");
		const result = Effect.runSync(pipe(a, intersect(b)));
		expect(satisfies(v(2, 5, 0), result)).toBe(true);
		expect(satisfies(v(1, 0, 0), result)).toBe(false);
	});

	it("pipe(sub, isSubset(sup)) works (data-last)", () => {
		const sub = r(">=1.0.0 <2.0.0");
		const sup = r(">=0.0.0 <3.0.0");
		expect(pipe(sub, isSubset(sup))).toBe(true);
	});

	it("pipe(a, equivalent(b)) works (data-last)", () => {
		const a = r(">=1.0.0 <2.0.0");
		const b = r(">=1.0.0 <2.0.0");
		expect(pipe(a, equivalent(b))).toBe(true);
	});
});
