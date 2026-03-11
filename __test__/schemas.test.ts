import { Equal } from "effect";
import { describe, expect, it } from "vitest";
import * as Comparator from "../src/Comparator.js";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";
import * as VersionDiff from "../src/VersionDiff.js";

const v = SemVer.make;

describe("Comparator", () => {
	describe("Construction", () => {
		it('has _tag of "Comparator"', () => {
			const c = new Comparator.Comparator({ operator: "=", version: v(1, 0, 0) });
			expect(c._tag).toBe("Comparator");
		});

		it("stores operator and version", () => {
			const ver = v(2, 3, 4);
			const c = new Comparator.Comparator({ operator: ">=", version: ver });
			expect(c.operator).toBe(">=");
			expect(c.version.major).toBe(2);
			expect(c.version.minor).toBe(3);
			expect(c.version.patch).toBe(4);
		});

		it.each(["=", ">", ">=", "<", "<="] as const)("accepts operator %s", (op) => {
			const c = new Comparator.Comparator({ operator: op, version: v(1, 0, 0) });
			expect(c.operator).toBe(op);
		});
	});

	describe("toString", () => {
		it('"=" operator renders as empty string (just version)', () => {
			const c = new Comparator.Comparator({ operator: "=", version: v(1, 2, 3) });
			expect(c.toString()).toBe("1.2.3");
		});

		it('">" operator renders with prefix', () => {
			const c = new Comparator.Comparator({ operator: ">", version: v(1, 0, 0) });
			expect(c.toString()).toBe(">1.0.0");
		});

		it('">=" operator renders with prefix', () => {
			const c = new Comparator.Comparator({ operator: ">=", version: v(2, 0, 0) });
			expect(c.toString()).toBe(">=2.0.0");
		});

		it('"<" operator renders with prefix', () => {
			const c = new Comparator.Comparator({ operator: "<", version: v(3, 0, 0) });
			expect(c.toString()).toBe("<3.0.0");
		});

		it('"<=" operator renders with prefix', () => {
			const c = new Comparator.Comparator({ operator: "<=", version: v(4, 5, 6) });
			expect(c.toString()).toBe("<=4.5.6");
		});

		it("includes prerelease in output", () => {
			const c = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0, ["alpha", 1]) });
			expect(c.toString()).toBe(">=1.0.0-alpha.1");
		});
	});

	describe("Structural equality", () => {
		it("equal comparators are Equal.equals", () => {
			const a = new Comparator.Comparator({ operator: ">=", version: v(1, 2, 3) });
			const b = new Comparator.Comparator({ operator: ">=", version: v(1, 2, 3) });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("different operators are not equal", () => {
			const a = new Comparator.Comparator({ operator: ">", version: v(1, 0, 0) });
			const b = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("different versions are not equal", () => {
			const a = new Comparator.Comparator({ operator: "=", version: v(1, 0, 0) });
			const b = new Comparator.Comparator({ operator: "=", version: v(2, 0, 0) });
			expect(Equal.equals(a, b)).toBe(false);
		});
	});
});

describe("Range", () => {
	describe("Construction", () => {
		it('has _tag of "Range"', () => {
			const r = new Range.Range({ sets: [] });
			expect(r._tag).toBe("Range");
		});

		it("stores sets (array of arrays of Comparators)", () => {
			const c1 = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
			const c2 = new Comparator.Comparator({ operator: "<", version: v(2, 0, 0) });
			const r = new Range.Range({ sets: [[c1, c2]] });
			expect(r.sets).toHaveLength(1);
			expect(r.sets[0]).toHaveLength(2);
		});
	});

	describe("toString", () => {
		it("joins comparators within a set with space", () => {
			const c1 = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
			const c2 = new Comparator.Comparator({ operator: "<", version: v(2, 0, 0) });
			const r = new Range.Range({ sets: [[c1, c2]] });
			expect(r.toString()).toBe(">=1.0.0 <2.0.0");
		});

		it('joins comparator sets with " || "', () => {
			const c1 = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
			const c2 = new Comparator.Comparator({ operator: "<", version: v(2, 0, 0) });
			const c3 = new Comparator.Comparator({ operator: ">=", version: v(3, 0, 0) });
			const r = new Range.Range({ sets: [[c1, c2], [c3]] });
			expect(r.toString()).toBe(">=1.0.0 <2.0.0 || >=3.0.0");
		});

		it("empty sets produce empty string", () => {
			const r = new Range.Range({ sets: [] });
			expect(r.toString()).toBe("");
		});

		it("single exact comparator renders without operator", () => {
			const c = new Comparator.Comparator({ operator: "=", version: v(1, 2, 3) });
			const r = new Range.Range({ sets: [[c]] });
			expect(r.toString()).toBe("1.2.3");
		});
	});

	describe("Structural equality", () => {
		it("ranges with same comparator references are Equal.equals", () => {
			const c1 = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
			const c2 = new Comparator.Comparator({ operator: "<", version: v(2, 0, 0) });
			const sets = [[c1, c2]];
			const a = new Range.Range({ sets });
			const b = new Range.Range({ sets });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("different ranges are not equal", () => {
			const a = new Range.Range({
				sets: [[new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) })]],
			});
			const b = new Range.Range({
				sets: [[new Comparator.Comparator({ operator: ">=", version: v(2, 0, 0) })]],
			});
			expect(Equal.equals(a, b)).toBe(false);
		});
	});
});

describe("VersionDiff", () => {
	describe("Construction", () => {
		it('has _tag of "VersionDiff"', () => {
			const d = new VersionDiff.VersionDiff({
				type: "major",
				from: v(1, 0, 0),
				to: v(2, 0, 0),
				major: 1,
				minor: 0,
				patch: 0,
			});
			expect(d._tag).toBe("VersionDiff");
		});

		it("stores type, from, to, and deltas", () => {
			const d = new VersionDiff.VersionDiff({
				type: "minor",
				from: v(1, 2, 3),
				to: v(1, 3, 0),
				major: 0,
				minor: 1,
				patch: -3,
			});
			expect(d.type).toBe("minor");
			expect(d.from.major).toBe(1);
			expect(d.to.minor).toBe(3);
			expect(d.major).toBe(0);
			expect(d.minor).toBe(1);
			expect(d.patch).toBe(-3);
		});

		it.each(["major", "minor", "patch", "prerelease", "build", "none"] as const)('accepts type "%s"', (type) => {
			const d = new VersionDiff.VersionDiff({
				type,
				from: v(1, 0, 0),
				to: v(1, 0, 0),
				major: 0,
				minor: 0,
				patch: 0,
			});
			expect(d.type).toBe(type);
		});
	});

	describe("Structural equality", () => {
		it("equal diffs are Equal.equals", () => {
			const a = new VersionDiff.VersionDiff({
				type: "patch",
				from: v(1, 0, 0),
				to: v(1, 0, 1),
				major: 0,
				minor: 0,
				patch: 1,
			});
			const b = new VersionDiff.VersionDiff({
				type: "patch",
				from: v(1, 0, 0),
				to: v(1, 0, 1),
				major: 0,
				minor: 0,
				patch: 1,
			});
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("different diffs are not equal", () => {
			const a = new VersionDiff.VersionDiff({
				type: "major",
				from: v(1, 0, 0),
				to: v(2, 0, 0),
				major: 1,
				minor: 0,
				patch: 0,
			});
			const b = new VersionDiff.VersionDiff({
				type: "minor",
				from: v(1, 0, 0),
				to: v(1, 1, 0),
				major: 0,
				minor: 1,
				patch: 0,
			});
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("same type but different deltas are not equal", () => {
			const a = new VersionDiff.VersionDiff({
				type: "patch",
				from: v(1, 0, 0),
				to: v(1, 0, 1),
				major: 0,
				minor: 0,
				patch: 1,
			});
			const b = new VersionDiff.VersionDiff({
				type: "patch",
				from: v(1, 0, 0),
				to: v(1, 0, 2),
				major: 0,
				minor: 0,
				patch: 2,
			});
			expect(Equal.equals(a, b)).toBe(false);
		});
	});
});

describe("VersionDiff toString and toJSON", () => {
	it("toString formats as type (from -> to)", () => {
		const d = new VersionDiff.VersionDiff({
			type: "minor",
			from: v(1, 2, 0),
			to: v(1, 3, 0),
			major: 0,
			minor: 1,
			patch: 0,
		});
		expect(d.toString()).toBe("minor (1.2.0 \u2192 1.3.0)");
	});

	it("toString with none type", () => {
		const d = new VersionDiff.VersionDiff({
			type: "none",
			from: v(1, 0, 0),
			to: v(1, 0, 0),
			major: 0,
			minor: 0,
			patch: 0,
		});
		expect(d.toString()).toBe("none (1.0.0 \u2192 1.0.0)");
	});

	it("toString with prerelease versions", () => {
		const d = new VersionDiff.VersionDiff({
			type: "prerelease",
			from: v(1, 0, 0, ["alpha"]),
			to: v(1, 0, 0, ["beta"]),
			major: 0,
			minor: 0,
			patch: 0,
		});
		expect(d.toString()).toBe("prerelease (1.0.0-alpha \u2192 1.0.0-beta)");
	});

	it("toJSON includes _tag and all fields", () => {
		const d = new VersionDiff.VersionDiff({
			type: "major",
			from: v(1, 0, 0),
			to: v(2, 0, 0),
			major: 1,
			minor: 0,
			patch: 0,
		});
		const json = d.toJSON() as Record<string, unknown>;
		expect(json._tag).toBe("VersionDiff");
		expect(json.type).toBe("major");
		expect(json.major).toBe(1);
	});

	it("toJSON nests from/to as SemVer JSON", () => {
		const d = new VersionDiff.VersionDiff({
			type: "patch",
			from: v(1, 0, 0),
			to: v(1, 0, 1),
			major: 0,
			minor: 0,
			patch: 1,
		});
		const json = d.toJSON() as Record<string, unknown>;
		const from = json.from as Record<string, unknown>;
		expect(from._tag).toBe("SemVer");
		expect(from.major).toBe(1);
	});
});

describe("SemVer toJSON", () => {
	it("returns tagged JSON object", () => {
		const sv = v(1, 2, 3, ["alpha"], ["build"]);
		const json = sv.toJSON() as Record<string, unknown>;
		expect(json._tag).toBe("SemVer");
		expect(json.major).toBe(1);
		expect(json.minor).toBe(2);
		expect(json.patch).toBe(3);
		expect(json.prerelease).toEqual(["alpha"]);
		expect(json.build).toEqual(["build"]);
	});

	it("returns empty arrays for no prerelease/build", () => {
		const sv = v(0, 0, 1);
		const json = sv.toJSON() as Record<string, unknown>;
		expect(json.prerelease).toEqual([]);
		expect(json.build).toEqual([]);
	});
});
