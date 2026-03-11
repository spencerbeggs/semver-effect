import { inspect } from "node:util";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import * as Comparator from "../src/Comparator.js";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";
import { parseRangeSet, parseSingleComparator } from "../src/utils/grammar.js";
import { normalizeRange } from "../src/utils/normalize.js";

const v = SemVer.make;

const comp = (op: "=" | ">" | ">=" | "<" | "<=", ver: SemVer.SemVer) =>
	new Comparator.Comparator({ operator: op, version: ver });

const range = (...sets: ReadonlyArray<ReadonlyArray<Comparator.Comparator>>) =>
	new Range.Range({ sets: sets.map((s) => [...s]) });

const r = (input: string) => Effect.runSync(Range.fromString(input));

// ---------------------------------------------------------------------------
// 1. normalize.ts — operator weight sorting & duplicate removal
// ---------------------------------------------------------------------------

describe("normalize", () => {
	it("sorts comparators by operator weight", () => {
		const unsorted = range([
			comp("<", v(3, 0, 0)), // weight 3
			comp(">=", v(1, 0, 0)), // weight 0
			comp("<=", v(5, 0, 0)), // weight 4
			comp(">", v(2, 0, 0)), // weight 1
			comp("=", v(2, 5, 0)), // weight 2
		]);
		const normalized = normalizeRange(unsorted);
		const ops = normalized.sets[0].map((c) => c.operator);
		expect(ops).toEqual([">=", ">", "=", "<", "<="]);
	});

	it("removes duplicate comparators", () => {
		const dups = range([
			comp(">=", v(1, 0, 0)),
			comp("<", v(2, 0, 0)),
			comp(">=", v(1, 0, 0)), // duplicate
		]);
		const normalized = normalizeRange(dups);
		expect(normalized.sets[0]).toHaveLength(2);
	});

	it("sorts by version when operator is same", () => {
		const unsorted = range([comp(">=", v(3, 0, 0)), comp(">=", v(1, 0, 0))]);
		const normalized = normalizeRange(unsorted);
		expect(normalized.sets[0][0].version.major).toBe(1);
		expect(normalized.sets[0][1].version.major).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// 2. desugar.ts — all branch paths via range parsing
// ---------------------------------------------------------------------------

describe("desugar branches via range parsing", () => {
	// Tilde
	it("~1 -> >=1.0.0 <2.0.0-0", () => {
		const parsed = r("~1");
		expect(parsed.toString()).toBe(">=1.0.0 <2.0.0-0");
	});

	it("~1.2 -> >=1.2.0 <1.3.0-0", () => {
		const parsed = r("~1.2");
		expect(parsed.toString()).toBe(">=1.2.0 <1.3.0-0");
	});

	it("~1.2.3 -> >=1.2.3 <1.3.0-0", () => {
		const parsed = r("~1.2.3");
		expect(parsed.toString()).toBe(">=1.2.3 <1.3.0-0");
	});

	// Caret
	it("^1.2.3 -> >=1.2.3 <2.0.0-0", () => {
		const parsed = r("^1.2.3");
		expect(parsed.toString()).toBe(">=1.2.3 <2.0.0-0");
	});

	it("^0.2.3 -> >=0.2.3 <0.3.0-0", () => {
		const parsed = r("^0.2.3");
		expect(parsed.toString()).toBe(">=0.2.3 <0.3.0-0");
	});

	it("^0.0.3 -> >=0.0.3 <0.0.4-0", () => {
		const parsed = r("^0.0.3");
		expect(parsed.toString()).toBe(">=0.0.3 <0.0.4-0");
	});

	it("^0.0.0 -> >=0.0.0 <0.0.1-0", () => {
		const parsed = r("^0.0.0");
		expect(parsed.toString()).toBe(">=0.0.0 <0.0.1-0");
	});

	it("^0.x -> >=0.0.0 <1.0.0-0", () => {
		const parsed = r("^0.x");
		expect(parsed.toString()).toBe(">=0.0.0 <1.0.0-0");
	});

	it("^0.0.x -> >=0.0.0 <0.1.0-0", () => {
		const parsed = r("^0.0.x");
		expect(parsed.toString()).toBe(">=0.0.0 <0.1.0-0");
	});

	// X-range
	it("* -> >=0.0.0", () => {
		const parsed = r("*");
		expect(parsed.toString()).toBe(">=0.0.0");
	});

	it("1.x -> >=1.0.0 <2.0.0-0", () => {
		const parsed = r("1.x");
		expect(parsed.toString()).toBe(">=1.0.0 <2.0.0-0");
	});

	it("1.2.x -> >=1.2.0 <1.3.0-0", () => {
		const parsed = r("1.2.x");
		expect(parsed.toString()).toBe(">=1.2.0 <1.3.0-0");
	});

	// X-range with operators
	it(">1.x -> >=2.0.0", () => {
		const parsed = r(">1.x");
		expect(parsed.toString()).toBe(">=2.0.0");
	});

	it(">=1.x -> >=1.0.0", () => {
		const parsed = r(">=1.x");
		expect(parsed.toString()).toBe(">=1.0.0");
	});

	it("<1.x -> <1.0.0", () => {
		const parsed = r("<1.x");
		expect(parsed.toString()).toBe("<1.0.0");
	});

	it("<=1.x -> <2.0.0-0", () => {
		const parsed = r("<=1.x");
		expect(parsed.toString()).toBe("<2.0.0-0");
	});

	it(">1.2.x -> >=1.3.0", () => {
		const parsed = r(">1.2.x");
		expect(parsed.toString()).toBe(">=1.3.0");
	});

	it(">=1.2.x -> >=1.2.0", () => {
		const parsed = r(">=1.2.x");
		expect(parsed.toString()).toBe(">=1.2.0");
	});

	it("<1.2.x -> <1.2.0", () => {
		const parsed = r("<1.2.x");
		expect(parsed.toString()).toBe("<1.2.0");
	});

	it("<=1.2.x -> <1.3.0-0", () => {
		const parsed = r("<=1.2.x");
		expect(parsed.toString()).toBe("<1.3.0-0");
	});

	// Hyphen ranges
	it("1.2.3 - 2.3.4 -> >=1.2.3 <=2.3.4", () => {
		const parsed = r("1.2.3 - 2.3.4");
		expect(parsed.toString()).toBe(">=1.2.3 <=2.3.4");
	});

	it("1.2 - 2.3.4 -> >=1.2.0 <=2.3.4 (partial lower)", () => {
		const parsed = r("1.2 - 2.3.4");
		expect(parsed.toString()).toBe(">=1.2.0 <=2.3.4");
	});

	it("1.2.3 - 2.3 -> >=1.2.3 <2.4.0-0 (partial upper minor)", () => {
		const parsed = r("1.2.3 - 2.3");
		expect(parsed.toString()).toBe(">=1.2.3 <2.4.0-0");
	});

	it("1.2.3 - 2 -> >=1.2.3 <3.0.0-0 (partial upper major only)", () => {
		const parsed = r("1.2.3 - 2");
		expect(parsed.toString()).toBe(">=1.2.3 <3.0.0-0");
	});
});

// ---------------------------------------------------------------------------
// 3. algebra.ts — isSetSatisfiable and isComparatorImplied branches
// ---------------------------------------------------------------------------

describe("algebra branches", () => {
	// isSetSatisfiable: = conflicts with > bound
	it("intersect fails when = conflicts with > bound", () => {
		const a = range([comp("=", v(1, 0, 0))]);
		const b = range([comp(">", v(1, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: = conflicts with < bound
	it("intersect fails when = conflicts with < bound", () => {
		const a = range([comp("=", v(2, 0, 0))]);
		const b = range([comp("<", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: = equals > version (cmp<=0 means false)
	it("intersect fails when = version equals > version", () => {
		const a = range([comp("=", v(1, 0, 0))]);
		const b = range([comp(">", v(1, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: = lower than >= version
	it("intersect fails when = version below >= bound", () => {
		const a = range([comp("=", v(1, 0, 0))]);
		const b = range([comp(">=", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: = above <= version
	it("intersect fails when = version above <= bound", () => {
		const a = range([comp("=", v(3, 0, 0))]);
		const b = range([comp("<=", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: two = comparators that differ
	it("intersect fails when two = comparators differ", () => {
		const a = range([comp("=", v(1, 0, 0))]);
		const b = range([comp("=", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: >= and <= that work (satisfiable)
	it("intersect succeeds when >= <= are compatible", () => {
		const a = range([comp(">=", v(1, 0, 0))]);
		const b = range([comp("<=", v(2, 0, 0))]);
		const result = Effect.runSync(Range.intersect(a, b));
		expect(result.sets).toHaveLength(1);
		expect(result.sets[0]).toHaveLength(2);
	});

	// isSetSatisfiable: > and <= where > equals <= (unsatisfiable)
	it("intersect fails when > version equals <= version", () => {
		const a = range([comp(">", v(1, 0, 0))]);
		const b = range([comp("<=", v(1, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: >= and < where >= equals < (unsatisfiable)
	it("intersect fails when >= version equals < version", () => {
		const a = range([comp(">=", v(2, 0, 0))]);
		const b = range([comp("<", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: > and < where > > < (unsatisfiable)
	it("intersect fails when > version above < version", () => {
		const a = range([comp(">", v(3, 0, 0))]);
		const b = range([comp("<", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// isSetSatisfiable: >= and <= where >= > <= (unsatisfiable)
	it("intersect fails when >= above <=", () => {
		const a = range([comp(">=", v(3, 0, 0))]);
		const b = range([comp("<=", v(2, 0, 0))]);
		expect(() => Effect.runSync(Range.intersect(a, b))).toThrow();
	});

	// intersect with multi-set ranges producing valid merge
	it("intersect with multi-set ranges keeps satisfiable combinations", () => {
		const a = range([comp(">=", v(1, 0, 0)), comp("<", v(2, 0, 0))], [comp(">=", v(3, 0, 0))]);
		const b = range([comp(">=", v(1, 5, 0))]);
		const result = Effect.runSync(Range.intersect(a, b));
		expect(result.sets.length).toBeGreaterThanOrEqual(1);
	});

	// isComparatorImplied: >= implied by >= with higher version
	it("isSubset: >= implied by >=", () => {
		const sub = range([comp(">=", v(2, 0, 0)), comp("<", v(3, 0, 0))]);
		const sup = range([comp(">=", v(1, 0, 0)), comp("<", v(3, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: > implied by > with higher version
	it("isSubset: > implied by >", () => {
		const sub = range([comp(">", v(2, 0, 0))]);
		const sup = range([comp(">", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: > implied by >= with higher version
	it("isSubset: > implied by >=", () => {
		const sub = range([comp(">", v(2, 0, 0))]);
		const sup = range([comp(">=", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: <= implied by <=
	it("isSubset: <= implied by <=", () => {
		const sub = range([comp("<=", v(2, 0, 0))]);
		const sup = range([comp("<=", v(3, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: < implied by <
	it("isSubset: < implied by <", () => {
		const sub = range([comp("<", v(2, 0, 0))]);
		const sup = range([comp("<", v(3, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: < implied by <=
	it("isSubset: < implied by <=", () => {
		const sub = range([comp("<", v(2, 0, 0))]);
		const sup = range([comp("<=", v(3, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: = implied by =
	it("isSubset: = implied by =", () => {
		const sub = range([comp("=", v(1, 0, 0))]);
		const sup = range([comp("=", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: = implied by >=
	it("isSubset: >= implied by = at same version", () => {
		const sub = range([comp("=", v(1, 0, 0))]);
		const sup = range([comp(">=", v(1, 0, 0)), comp("<=", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: >= with = where cmp>=0
	it("isSubset: >= implied by = when = version >= comp version", () => {
		const sub = range([comp("=", v(2, 0, 0))]);
		const sup = range([comp(">=", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: > with = where cmp>0
	it("isSubset: > implied by = when = version > comp version", () => {
		const sub = range([comp("=", v(2, 0, 0))]);
		const sup = range([comp(">", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: <= with = where cmp<=0
	it("isSubset: <= implied by = when = version <= comp version", () => {
		const sub = range([comp("=", v(1, 0, 0))]);
		const sup = range([comp("<=", v(2, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// isComparatorImplied: < with = where cmp<0
	it("isSubset: < implied by = when = version < comp version", () => {
		const sub = range([comp("=", v(1, 0, 0))]);
		const sup = range([comp("<", v(2, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(true);
	});

	// equivalent
	it("equivalent returns true for identical ranges", () => {
		const a = range([comp(">=", v(1, 0, 0)), comp("<", v(2, 0, 0))]);
		expect(Range.equivalent(a, a)).toBe(true);
	});

	// simplify with redundant sets
	it("simplify removes redundant sets", () => {
		// Set A: >=1.0.0 <3.0.0 — wider
		// Set B: >=1.0.0 <2.0.0 — narrower, implied by A
		const a = range([comp(">=", v(1, 0, 0)), comp("<", v(3, 0, 0))], [comp(">=", v(1, 0, 0)), comp("<", v(2, 0, 0))]);
		const result = Range.simplify(a);
		expect(result.sets).toHaveLength(1);
	});

	// simplify when no sets are redundant returns all
	it("simplify keeps non-redundant sets", () => {
		const a = range([comp(">=", v(1, 0, 0)), comp("<", v(2, 0, 0))], [comp(">=", v(3, 0, 0)), comp("<", v(4, 0, 0))]);
		const result = Range.simplify(a);
		expect(result.sets).toHaveLength(2);
	});

	// union
	it("union combines range sets", () => {
		const a = range([comp(">=", v(1, 0, 0))]);
		const b = range([comp("<", v(2, 0, 0))]);
		const result = Range.union(a, b);
		expect(result.sets).toHaveLength(2);
	});

	// data-last (pipe) style
	it("isSubset supports data-last (pipe) style", () => {
		const sub = range([comp(">=", v(1, 0, 0)), comp("<", v(2, 0, 0))]);
		const sup = range([comp(">=", v(0, 0, 0))]);
		const check = Range.isSubset(sup);
		expect(check(sub)).toBe(true);
	});

	it("union supports data-last style", () => {
		const a = range([comp(">=", v(1, 0, 0))]);
		const b = range([comp("<", v(2, 0, 0))]);
		const result = Range.union(b)(a);
		expect(result.sets).toHaveLength(2);
	});

	it("equivalent supports data-last style", () => {
		const a = range([comp(">=", v(1, 0, 0))]);
		const check = Range.equivalent(a);
		expect(check(a)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 4. grammar.ts — error paths and edge cases
// ---------------------------------------------------------------------------

describe("grammar branches", () => {
	// parsePartial with only major (1)
	it("parses partial with only major via range", () => {
		const parsed = r("1");
		// "1" is treated as "1.x.x" -> >=1.0.0 <2.0.0-0
		expect(parsed.toString()).toBe(">=1.0.0 <2.0.0-0");
	});

	// parsePartial with major.minor (1.2)
	it("parses partial with major.minor via range", () => {
		const parsed = r("1.2");
		// "1.2" is treated as "1.2.x" -> >=1.2.0 <1.3.0-0
		expect(parsed.toString()).toBe(">=1.2.0 <1.3.0-0");
	});

	// Version at large numbers
	it("parses version with large numbers", () => {
		const sv = Effect.runSync(SemVer.fromString("999.999.999"));
		expect(sv.major).toBe(999);
	});

	// Empty string version
	it("rejects empty version string", () => {
		expect(() => Effect.runSync(SemVer.fromString(""))).toThrow();
	});

	// v-prefix
	it("rejects v-prefix", () => {
		expect(() => Effect.runSync(SemVer.fromString("v1.0.0"))).toThrow();
	});

	// V-prefix
	it("rejects V-prefix", () => {
		expect(() => Effect.runSync(SemVer.fromString("V1.0.0"))).toThrow();
	});

	// = prefix
	it("rejects = prefix on version", () => {
		expect(() => Effect.runSync(SemVer.fromString("=1.0.0"))).toThrow();
	});

	// Leading zero
	it("rejects leading zero in major", () => {
		expect(() => Effect.runSync(SemVer.fromString("01.0.0"))).toThrow();
	});

	it("rejects leading zero in numeric prerelease", () => {
		expect(() => Effect.runSync(SemVer.fromString("1.0.0-01"))).toThrow();
	});

	// Missing components
	it("rejects version with only major", () => {
		expect(() => Effect.runSync(SemVer.fromString("1"))).toThrow();
	});

	it("rejects version with only major.minor", () => {
		expect(() => Effect.runSync(SemVer.fromString("1.0"))).toThrow();
	});

	// Extra content after valid version
	it("rejects extra content after version", () => {
		expect(() => Effect.runSync(SemVer.fromString("1.0.0.0"))).toThrow();
	});

	// Empty range string parses as match-all
	it("empty range string matches all", () => {
		const parsed = Effect.runSync(parseRangeSet(""));
		expect(parsed.toString()).toBe(">=0.0.0");
	});

	// Range with || separator
	it("parses range with || separator", () => {
		const parsed = r(">=1.0.0 || >=2.0.0");
		expect(parsed.sets).toHaveLength(2);
	});

	// parseSingleComparator
	it("parseSingleComparator parses valid comparator", () => {
		const c = Effect.runSync(Comparator.fromString(">=1.2.3"));
		expect(c.operator).toBe(">=");
		expect(c.version.major).toBe(1);
	});

	it("parseSingleComparator rejects empty string", () => {
		expect(() => Effect.runSync(Comparator.fromString(""))).toThrow();
	});

	it("parseSingleComparator rejects double operator >>", () => {
		expect(() => Effect.runSync(Comparator.fromString(">>1.0.0"))).toThrow();
	});

	it("parseSingleComparator parses with no operator as =", () => {
		const c = Effect.runSync(Comparator.fromString("1.2.3"));
		expect(c.operator).toBe("=");
	});

	it("parseSingleComparator parses with prerelease", () => {
		const c = Effect.runSync(Comparator.fromString(">=1.0.0-alpha.1"));
		expect(c.version.prerelease).toEqual(["alpha", 1]);
	});

	it("parseSingleComparator parses with build", () => {
		const c = Effect.runSync(Comparator.fromString(">=1.0.0+build.123"));
		expect(c.version.build).toEqual(["build", "123"]);
	});

	it("parseSingleComparator rejects missing patch", () => {
		expect(() => Effect.runSync(parseSingleComparator("1.0"))).toThrow();
	});

	it("parseSingleComparator rejects extra content", () => {
		expect(() => Effect.runSync(parseSingleComparator("1.0.0 extra"))).toThrow();
	});

	// Tilde rejects ~>
	it("range rejects ~> (Ruby style)", () => {
		expect(() => Effect.runSync(Range.fromString("~>1.0.0"))).toThrow();
	});

	// Range with trailing content
	it("range rejects trailing content", () => {
		expect(() => Effect.runSync(Range.fromString("1.0.0 invalid!"))).toThrow();
	});
});

// ---------------------------------------------------------------------------
// 5. order.ts — SemVerOrderWithBuild branches
// ---------------------------------------------------------------------------

describe("SemVerOrderWithBuild", () => {
	it("no build < has build", () => {
		const a = v(1, 0, 0);
		const b = v(1, 0, 0, [], ["build"]);
		expect(SemVer.OrderWithBuild(a, b)).toBe(-1);
	});

	it("has build > no build", () => {
		const a = v(1, 0, 0, [], ["build"]);
		const b = v(1, 0, 0);
		expect(SemVer.OrderWithBuild(a, b)).toBe(1);
	});

	it("lexicographic build comparison", () => {
		const a = v(1, 0, 0, [], ["aaa"]);
		const b = v(1, 0, 0, [], ["bbb"]);
		expect(SemVer.OrderWithBuild(a, b)).toBe(-1);
	});

	it("reverse lexicographic build comparison", () => {
		const a = v(1, 0, 0, [], ["bbb"]);
		const b = v(1, 0, 0, [], ["aaa"]);
		expect(SemVer.OrderWithBuild(a, b)).toBe(1);
	});

	it("shorter build < longer build when prefix matches", () => {
		const a = v(1, 0, 0, [], ["build"]);
		const b = v(1, 0, 0, [], ["build", "extra"]);
		expect(SemVer.OrderWithBuild(a, b)).toBe(-1);
	});

	it("longer build > shorter build when prefix matches", () => {
		const a = v(1, 0, 0, [], ["build", "extra"]);
		const b = v(1, 0, 0, [], ["build"]);
		expect(SemVer.OrderWithBuild(a, b)).toBe(1);
	});

	it("equal builds return 0", () => {
		const a = v(1, 0, 0, [], ["build"]);
		const b = v(1, 0, 0, [], ["build"]);
		expect(SemVer.OrderWithBuild(a, b)).toBe(0);
	});

	it("both no builds returns 0", () => {
		const a = v(1, 0, 0);
		const b = v(1, 0, 0);
		expect(SemVer.OrderWithBuild(a, b)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 6. matching.ts — edge cases
// ---------------------------------------------------------------------------

describe("matching branches", () => {
	it("empty comparator set matches all versions", () => {
		const emptyRange = range([]);
		expect(Range.satisfies(v(1, 0, 0), emptyRange)).toBe(true);
		expect(Range.satisfies(v(999, 0, 0), emptyRange)).toBe(true);
	});

	it("prerelease version rejected when no comparator has matching tuple", () => {
		// Range >=1.0.0 <2.0.0 does NOT have prerelease comparators
		const parsed = r(">=1.0.0 <2.0.0");
		// 1.5.0-alpha has prerelease, no comparator shares [1,5,0] tuple
		expect(Range.satisfies(v(1, 5, 0, ["alpha"]), parsed)).toBe(false);
	});

	it("prerelease version accepted when comparator has matching tuple", () => {
		// >=1.0.0-alpha <1.0.1 — comparator has [1,0,0] tuple with prerelease
		const parsed = r(">=1.0.0-alpha <1.0.1");
		expect(Range.satisfies(v(1, 0, 0, ["beta"]), parsed)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 7. bump.ts — bumpPrerelease coverage
// ---------------------------------------------------------------------------

describe("bumpPrerelease coverage", () => {
	it("id provided, no existing prerelease", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0), "beta");
		expect(result.toString()).toBe("1.0.1-beta.0");
	});

	it("existing numeric prerelease, no id -> increment", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, [0]));
		expect(result.toString()).toBe("1.0.0-1");
	});

	it("current prefix is numeric -> null !== 'alpha' -> reset", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, [0]), "alpha");
		expect(result.toString()).toBe("1.0.0-alpha.0");
	});

	it("different string prefix -> reset", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha", 1]), "beta");
		expect(result.toString()).toBe("1.0.0-beta.0");
	});

	it("same prefix -> increment", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha", 1]), "alpha");
		expect(result.toString()).toBe("1.0.0-alpha.2");
	});

	it("last is string -> append 0", () => {
		const result = SemVer.bump.prerelease(v(1, 0, 0, ["alpha"]));
		expect(result.toString()).toBe("1.0.0-alpha.0");
	});
});

// ---------------------------------------------------------------------------
// 8. algebra.ts — isComparatorImplied fallthrough branches
// ---------------------------------------------------------------------------

describe("algebra isComparatorImplied fallthrough", () => {
	it("isSubset false when > not implied", () => {
		const sub = range([comp("<=", v(1, 0, 0))]);
		const sup = range([comp(">", v(2, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(false);
	});

	it("isSubset false when <= not implied", () => {
		const sub = range([comp(">=", v(3, 0, 0))]);
		const sup = range([comp("<=", v(1, 0, 0))]);
		expect(Range.isSubset(sub, sup)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 9. desugar.ts — >*, >=*, and hyphen with * upper
// ---------------------------------------------------------------------------

describe("desugar additional branches", () => {
	it(">* -> >=0.0.0", () => {
		const parsed = r(">*");
		expect(parsed.toString()).toBe(">=0.0.0");
	});

	it(">=* -> >=0.0.0", () => {
		const parsed = r(">=*");
		expect(parsed.toString()).toBe(">=0.0.0");
	});

	it("1.2.3 - * -> >=1.2.3", () => {
		const parsed = r("1.2.3 - *");
		expect(parsed.toString()).toBe(">=1.2.3");
	});
});

// ---------------------------------------------------------------------------
// 10. grammar.ts — parseSingleComparator error paths
// ---------------------------------------------------------------------------

describe("grammar parseSingleComparator error paths", () => {
	it("parseSingleComparator rejects invalid patch", () => {
		expect(() => Effect.runSync(parseSingleComparator("1.0.abc"))).toThrow();
	});

	it("parseSingleComparator rejects invalid prerelease", () => {
		expect(() => Effect.runSync(parseSingleComparator("1.0.0-"))).toThrow();
	});

	it("parseSingleComparator rejects invalid build", () => {
		expect(() => Effect.runSync(parseSingleComparator("1.0.0+"))).toThrow();
	});
});

// ---------------------------------------------------------------------------
// 11. inspect symbols — SemVer, Comparator, Range
// ---------------------------------------------------------------------------

describe("inspect symbols", () => {
	it("SemVer inspect symbol", () => {
		expect(inspect(v(1, 2, 3))).toBe("1.2.3");
	});

	it("Comparator inspect symbol", () => {
		const c = comp(">=", v(1, 0, 0));
		expect(inspect(c)).toBe(">=1.0.0");
	});

	it("Range inspect symbol", () => {
		const rng = range([comp(">=", v(1, 0, 0))]);
		expect(inspect(rng)).toBe(">=1.0.0");
	});
});

// ---------------------------------------------------------------------------
// 12. matching.ts — minSatisfying branch
// ---------------------------------------------------------------------------

describe("minSatisfying coverage", () => {
	it("minSatisfying returns the lowest matching version", () => {
		const versions = [v(1, 0, 0), v(2, 0, 0), v(3, 0, 0)];
		const parsed = r(">=1.0.0");
		const result = Range.minSatisfying(versions, parsed);
		expect(Option.isSome(result)).toBe(true);
		expect(String(Option.getOrThrow(result))).toBe("1.0.0");
	});
});
