import { Equal } from "effect";
import { describe, expect, it } from "vitest";
import { Comparator } from "../src/schemas/Comparator.js";
import { Range } from "../src/schemas/Range.js";
import { SemVer } from "../src/schemas/SemVer.js";
import { VersionDiff } from "../src/schemas/VersionDiff.js";

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) =>
	new SemVer(
		{
			major,
			minor,
			patch,
			prerelease: [...prerelease],
			build: [...build],
		},
		{ disableValidation: true },
	);

describe("Comparator", () => {
	describe("Construction", () => {
		it('has _tag of "Comparator"', () => {
			const c = new Comparator({ operator: "=", version: v(1, 0, 0) }, { disableValidation: true });
			expect(c._tag).toBe("Comparator");
		});

		it("stores operator and version", () => {
			const ver = v(2, 3, 4);
			const c = new Comparator({ operator: ">=", version: ver }, { disableValidation: true });
			expect(c.operator).toBe(">=");
			expect(c.version.major).toBe(2);
			expect(c.version.minor).toBe(3);
			expect(c.version.patch).toBe(4);
		});

		it.each(["=", ">", ">=", "<", "<="] as const)("accepts operator %s", (op) => {
			const c = new Comparator({ operator: op, version: v(1, 0, 0) }, { disableValidation: true });
			expect(c.operator).toBe(op);
		});
	});

	describe("toString", () => {
		it('"=" operator renders as empty string (just version)', () => {
			const c = new Comparator({ operator: "=", version: v(1, 2, 3) }, { disableValidation: true });
			expect(c.toString()).toBe("1.2.3");
		});

		it('">" operator renders with prefix', () => {
			const c = new Comparator({ operator: ">", version: v(1, 0, 0) }, { disableValidation: true });
			expect(c.toString()).toBe(">1.0.0");
		});

		it('">=" operator renders with prefix', () => {
			const c = new Comparator({ operator: ">=", version: v(2, 0, 0) }, { disableValidation: true });
			expect(c.toString()).toBe(">=2.0.0");
		});

		it('"<" operator renders with prefix', () => {
			const c = new Comparator({ operator: "<", version: v(3, 0, 0) }, { disableValidation: true });
			expect(c.toString()).toBe("<3.0.0");
		});

		it('"<=" operator renders with prefix', () => {
			const c = new Comparator({ operator: "<=", version: v(4, 5, 6) }, { disableValidation: true });
			expect(c.toString()).toBe("<=4.5.6");
		});

		it("includes prerelease in output", () => {
			const c = new Comparator({ operator: ">=", version: v(1, 0, 0, ["alpha", 1]) }, { disableValidation: true });
			expect(c.toString()).toBe(">=1.0.0-alpha.1");
		});
	});

	describe("Structural equality", () => {
		it("equal comparators are Equal.equals", () => {
			const a = new Comparator({ operator: ">=", version: v(1, 2, 3) }, { disableValidation: true });
			const b = new Comparator({ operator: ">=", version: v(1, 2, 3) }, { disableValidation: true });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("different operators are not equal", () => {
			const a = new Comparator({ operator: ">", version: v(1, 0, 0) }, { disableValidation: true });
			const b = new Comparator({ operator: ">=", version: v(1, 0, 0) }, { disableValidation: true });
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("different versions are not equal", () => {
			const a = new Comparator({ operator: "=", version: v(1, 0, 0) }, { disableValidation: true });
			const b = new Comparator({ operator: "=", version: v(2, 0, 0) }, { disableValidation: true });
			expect(Equal.equals(a, b)).toBe(false);
		});
	});
});

describe("Range", () => {
	describe("Construction", () => {
		it('has _tag of "Range"', () => {
			const r = new Range({ sets: [] }, { disableValidation: true });
			expect(r._tag).toBe("Range");
		});

		it("stores sets (array of arrays of Comparators)", () => {
			const c1 = new Comparator({ operator: ">=", version: v(1, 0, 0) }, { disableValidation: true });
			const c2 = new Comparator({ operator: "<", version: v(2, 0, 0) }, { disableValidation: true });
			const r = new Range({ sets: [[c1, c2]] }, { disableValidation: true });
			expect(r.sets).toHaveLength(1);
			expect(r.sets[0]).toHaveLength(2);
		});
	});

	describe("toString", () => {
		it("joins comparators within a set with space", () => {
			const c1 = new Comparator({ operator: ">=", version: v(1, 0, 0) }, { disableValidation: true });
			const c2 = new Comparator({ operator: "<", version: v(2, 0, 0) }, { disableValidation: true });
			const r = new Range({ sets: [[c1, c2]] }, { disableValidation: true });
			expect(r.toString()).toBe(">=1.0.0 <2.0.0");
		});

		it('joins comparator sets with " || "', () => {
			const c1 = new Comparator({ operator: ">=", version: v(1, 0, 0) }, { disableValidation: true });
			const c2 = new Comparator({ operator: "<", version: v(2, 0, 0) }, { disableValidation: true });
			const c3 = new Comparator({ operator: ">=", version: v(3, 0, 0) }, { disableValidation: true });
			const r = new Range({ sets: [[c1, c2], [c3]] }, { disableValidation: true });
			expect(r.toString()).toBe(">=1.0.0 <2.0.0 || >=3.0.0");
		});

		it("empty sets produce empty string", () => {
			const r = new Range({ sets: [] }, { disableValidation: true });
			expect(r.toString()).toBe("");
		});

		it("single exact comparator renders without operator", () => {
			const c = new Comparator({ operator: "=", version: v(1, 2, 3) }, { disableValidation: true });
			const r = new Range({ sets: [[c]] }, { disableValidation: true });
			expect(r.toString()).toBe("1.2.3");
		});
	});

	describe("Structural equality", () => {
		it("ranges with same comparator references are Equal.equals", () => {
			const c1 = new Comparator({ operator: ">=", version: v(1, 0, 0) }, { disableValidation: true });
			const c2 = new Comparator({ operator: "<", version: v(2, 0, 0) }, { disableValidation: true });
			const sets = [[c1, c2]];
			const a = new Range({ sets }, { disableValidation: true });
			const b = new Range({ sets }, { disableValidation: true });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("different ranges are not equal", () => {
			const a = new Range(
				{
					sets: [[new Comparator({ operator: ">=", version: v(1, 0, 0) }, { disableValidation: true })]],
				},
				{ disableValidation: true },
			);
			const b = new Range(
				{
					sets: [[new Comparator({ operator: ">=", version: v(2, 0, 0) }, { disableValidation: true })]],
				},
				{ disableValidation: true },
			);
			expect(Equal.equals(a, b)).toBe(false);
		});
	});
});

describe("VersionDiff", () => {
	describe("Construction", () => {
		it('has _tag of "VersionDiff"', () => {
			const d = new VersionDiff(
				{
					type: "major",
					from: v(1, 0, 0),
					to: v(2, 0, 0),
					major: 1,
					minor: 0,
					patch: 0,
				},
				{ disableValidation: true },
			);
			expect(d._tag).toBe("VersionDiff");
		});

		it("stores type, from, to, and deltas", () => {
			const d = new VersionDiff(
				{
					type: "minor",
					from: v(1, 2, 3),
					to: v(1, 3, 0),
					major: 0,
					minor: 1,
					patch: -3,
				},
				{ disableValidation: true },
			);
			expect(d.type).toBe("minor");
			expect(d.from.major).toBe(1);
			expect(d.to.minor).toBe(3);
			expect(d.major).toBe(0);
			expect(d.minor).toBe(1);
			expect(d.patch).toBe(-3);
		});

		it.each(["major", "minor", "patch", "prerelease", "build", "none"] as const)('accepts type "%s"', (type) => {
			const d = new VersionDiff(
				{
					type,
					from: v(1, 0, 0),
					to: v(1, 0, 0),
					major: 0,
					minor: 0,
					patch: 0,
				},
				{ disableValidation: true },
			);
			expect(d.type).toBe(type);
		});
	});

	describe("Structural equality", () => {
		it("equal diffs are Equal.equals", () => {
			const a = new VersionDiff(
				{
					type: "patch",
					from: v(1, 0, 0),
					to: v(1, 0, 1),
					major: 0,
					minor: 0,
					patch: 1,
				},
				{ disableValidation: true },
			);
			const b = new VersionDiff(
				{
					type: "patch",
					from: v(1, 0, 0),
					to: v(1, 0, 1),
					major: 0,
					minor: 0,
					patch: 1,
				},
				{ disableValidation: true },
			);
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("different diffs are not equal", () => {
			const a = new VersionDiff(
				{
					type: "major",
					from: v(1, 0, 0),
					to: v(2, 0, 0),
					major: 1,
					minor: 0,
					patch: 0,
				},
				{ disableValidation: true },
			);
			const b = new VersionDiff(
				{
					type: "minor",
					from: v(1, 0, 0),
					to: v(1, 1, 0),
					major: 0,
					minor: 1,
					patch: 0,
				},
				{ disableValidation: true },
			);
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("same type but different deltas are not equal", () => {
			const a = new VersionDiff(
				{
					type: "patch",
					from: v(1, 0, 0),
					to: v(1, 0, 1),
					major: 0,
					minor: 0,
					patch: 1,
				},
				{ disableValidation: true },
			);
			const b = new VersionDiff(
				{
					type: "patch",
					from: v(1, 0, 0),
					to: v(1, 0, 2),
					major: 0,
					minor: 0,
					patch: 2,
				},
				{ disableValidation: true },
			);
			expect(Equal.equals(a, b)).toBe(false);
		});
	});
});
