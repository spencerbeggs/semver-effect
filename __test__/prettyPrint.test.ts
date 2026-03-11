import { describe, expect, it } from "vitest";
import * as Comparator from "../src/Comparator.js";
import * as PrettyPrint from "../src/PrettyPrint.js";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";
import * as VersionDiff from "../src/VersionDiff.js";

const v = SemVer.make;

describe("prettyPrint", () => {
	it("formats SemVer", () => {
		expect(PrettyPrint.prettyPrint(v(1, 2, 3))).toBe("1.2.3");
		expect(PrettyPrint.prettyPrint(v(1, 2, 3, ["alpha", 1]))).toBe("1.2.3-alpha.1");
		expect(PrettyPrint.prettyPrint(v(1, 0, 0, [], ["build"]))).toBe("1.0.0+build");
		expect(PrettyPrint.prettyPrint(v(1, 0, 0, ["rc", 1], ["meta"]))).toBe("1.0.0-rc.1+meta");
	});

	it("formats Comparator", () => {
		const c = new Comparator.Comparator({ operator: ">=", version: v(1, 2, 3) });
		expect(PrettyPrint.prettyPrint(c)).toBe(">=1.2.3");
	});

	it("formats Comparator with = operator (suppressed)", () => {
		const c = new Comparator.Comparator({ operator: "=", version: v(1, 0, 0) });
		expect(PrettyPrint.prettyPrint(c)).toBe("1.0.0");
	});

	it("formats Range", () => {
		const c1 = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
		const c2 = new Comparator.Comparator({ operator: "<", version: v(2, 0, 0) });
		const range = new Range.Range({ sets: [[c1, c2]] });
		expect(PrettyPrint.prettyPrint(range)).toBe(">=1.0.0 <2.0.0");
	});

	it("formats Range with multiple sets", () => {
		const c1 = new Comparator.Comparator({ operator: ">=", version: v(1, 0, 0) });
		const c2 = new Comparator.Comparator({ operator: ">=", version: v(3, 0, 0) });
		const range = new Range.Range({ sets: [[c1], [c2]] });
		expect(PrettyPrint.prettyPrint(range)).toBe(">=1.0.0 || >=3.0.0");
	});

	it("formats VersionDiff", () => {
		const d = new VersionDiff.VersionDiff({
			type: "minor",
			from: v(1, 2, 0),
			to: v(1, 3, 0),
			major: 0,
			minor: 1,
			patch: 0,
		});
		expect(PrettyPrint.prettyPrint(d)).toBe("minor (1.2.0 → 1.3.0)");
	});

	it("formats VersionDiff type none", () => {
		const d = new VersionDiff.VersionDiff({
			type: "none",
			from: v(1, 0, 0),
			to: v(1, 0, 0),
			major: 0,
			minor: 0,
			patch: 0,
		});
		expect(PrettyPrint.prettyPrint(d)).toBe("none (1.0.0 → 1.0.0)");
	});
});
