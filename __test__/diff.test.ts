import { pipe } from "effect";
import { describe, expect, it } from "vitest";
import { SemVer } from "../src/schemas/SemVer.js";
import { diff } from "../src/utils/diff.js";

const v = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
) => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] }, { disableValidation: true });

describe("diff", () => {
	it("major bump: diff(1.0.0, 2.0.0)", () => {
		const result = diff(v(1, 0, 0), v(2, 0, 0));
		expect(result.type).toBe("major");
		expect(result.major).toBe(1);
		expect(result.minor).toBe(0);
		expect(result.patch).toBe(0);
	});

	it("minor bump: diff(1.2.3, 1.3.0)", () => {
		const result = diff(v(1, 2, 3), v(1, 3, 0));
		expect(result.type).toBe("minor");
		expect(result.major).toBe(0);
		expect(result.minor).toBe(1);
		expect(result.patch).toBe(-3);
	});

	it("patch bump: diff(1.2.3, 1.2.4)", () => {
		const result = diff(v(1, 2, 3), v(1, 2, 4));
		expect(result.type).toBe("patch");
		expect(result.patch).toBe(1);
	});

	it("prerelease: diff(1.0.0, 1.0.0-alpha)", () => {
		const result = diff(v(1, 0, 0), v(1, 0, 0, ["alpha"]));
		expect(result.type).toBe("prerelease");
	});

	it("prerelease: diff(1.0.0-alpha, 1.0.0-beta)", () => {
		const result = diff(v(1, 0, 0, ["alpha"]), v(1, 0, 0, ["beta"]));
		expect(result.type).toBe("prerelease");
	});

	it("build only: diff(1.0.0+a, 1.0.0+b)", () => {
		const result = diff(v(1, 0, 0, [], ["a"]), v(1, 0, 0, [], ["b"]));
		expect(result.type).toBe("build");
		expect(result.major).toBe(0);
		expect(result.minor).toBe(0);
		expect(result.patch).toBe(0);
	});

	it("none: diff(1.0.0, 1.0.0)", () => {
		const result = diff(v(1, 0, 0), v(1, 0, 0));
		expect(result.type).toBe("none");
		expect(result.major).toBe(0);
		expect(result.minor).toBe(0);
		expect(result.patch).toBe(0);
	});

	it("reverse direction: diff(2.0.0, 1.0.0)", () => {
		const result = diff(v(2, 0, 0), v(1, 0, 0));
		expect(result.type).toBe("major");
		expect(result.major).toBe(-1);
	});

	it("from/to reference correct versions", () => {
		const a = v(1, 0, 0);
		const b = v(2, 0, 0);
		const result = diff(a, b);
		expect(result.from).toBe(a);
		expect(result.to).toBe(b);
	});

	it("dual API: pipe(a, diff(b))", () => {
		const a = v(1, 0, 0);
		const b = v(2, 0, 0);
		const result = pipe(a, diff(b));
		expect(result.type).toBe("major");
		expect(result.major).toBe(1);
		expect(result.from).toBe(a);
		expect(result.to).toBe(b);
	});
});
