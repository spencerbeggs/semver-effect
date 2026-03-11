import { describe, expect, it } from "vitest";
import { Comparator } from "../src/schemas/Comparator.js";
import { Range } from "../src/schemas/Range.js";
import { SemVer } from "../src/schemas/SemVer.js";
import { VersionDiff } from "../src/schemas/VersionDiff.js";
import { prettyPrint } from "../src/utils/prettyPrint.js";

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });

describe("prettyPrint", () => {
	it("formats SemVer", () => {
		expect(prettyPrint(v(1, 2, 3))).toBe("1.2.3");
		expect(prettyPrint(v(1, 2, 3, ["alpha", 1]))).toBe("1.2.3-alpha.1");
		expect(prettyPrint(v(1, 0, 0, [], ["build"]))).toBe("1.0.0+build");
		expect(prettyPrint(v(1, 0, 0, ["rc", 1], ["meta"]))).toBe("1.0.0-rc.1+meta");
	});

	it("formats Comparator", () => {
		const c = new Comparator({ operator: ">=", version: v(1, 2, 3) });
		expect(prettyPrint(c)).toBe(">=1.2.3");
	});

	it("formats Comparator with = operator (suppressed)", () => {
		const c = new Comparator({ operator: "=", version: v(1, 0, 0) });
		expect(prettyPrint(c)).toBe("1.0.0");
	});

	it("formats Range", () => {
		const c1 = new Comparator({ operator: ">=", version: v(1, 0, 0) });
		const c2 = new Comparator({ operator: "<", version: v(2, 0, 0) });
		const range = new Range({ sets: [[c1, c2]] });
		expect(prettyPrint(range)).toBe(">=1.0.0 <2.0.0");
	});

	it("formats Range with multiple sets", () => {
		const c1 = new Comparator({ operator: ">=", version: v(1, 0, 0) });
		const c2 = new Comparator({ operator: ">=", version: v(3, 0, 0) });
		const range = new Range({ sets: [[c1], [c2]] });
		expect(prettyPrint(range)).toBe(">=1.0.0 || >=3.0.0");
	});

	it("formats VersionDiff", () => {
		const d = new VersionDiff({
			type: "minor",
			from: v(1, 2, 0),
			to: v(1, 3, 0),
			major: 0,
			minor: 1,
			patch: 0,
		});
		expect(prettyPrint(d)).toBe("minor (1.2.0 → 1.3.0)");
	});

	it("formats VersionDiff type none", () => {
		const d = new VersionDiff({
			type: "none",
			from: v(1, 0, 0),
			to: v(1, 0, 0),
			major: 0,
			minor: 0,
			patch: 0,
		});
		expect(prettyPrint(d)).toBe("none (1.0.0 → 1.0.0)");
	});
});
