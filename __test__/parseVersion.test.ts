import { Cause, Chunk, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { InvalidVersionError } from "../src/errors/InvalidVersionError.js";
import { parseValidSemVer } from "../src/utils/grammar.js";

const parse = (input: string) => Effect.runSync(parseValidSemVer(input));

const getError = (input: string): InvalidVersionError => {
	const exit = Effect.runSyncExit(parseValidSemVer(input));
	if (Exit.isFailure(exit)) {
		const failures = Cause.failures(exit.cause);
		const first = Chunk.get(failures, 0);
		if (first._tag === "Some") {
			return first.value as InvalidVersionError;
		}
	}
	throw new Error("Expected failure");
};

describe("parseValidSemVer", () => {
	describe("valid versions", () => {
		it("parses 0.0.0", () => {
			const v = parse("0.0.0");
			expect(v.major).toBe(0);
			expect(v.minor).toBe(0);
			expect(v.patch).toBe(0);
			expect(v.prerelease).toEqual([]);
			expect(v.build).toEqual([]);
		});

		it("parses 1.2.3", () => {
			const v = parse("1.2.3");
			expect(v.major).toBe(1);
			expect(v.minor).toBe(2);
			expect(v.patch).toBe(3);
		});

		it("parses 999.999.999", () => {
			const v = parse("999.999.999");
			expect(v.major).toBe(999);
			expect(v.minor).toBe(999);
			expect(v.patch).toBe(999);
		});

		it("parses 1.0.0-alpha", () => {
			const v = parse("1.0.0-alpha");
			expect(v.major).toBe(1);
			expect(v.prerelease).toEqual(["alpha"]);
		});

		it("parses 1.0.0-alpha.1", () => {
			const v = parse("1.0.0-alpha.1");
			expect(v.prerelease).toEqual(["alpha", 1]);
		});

		it("parses 1.0.0-0.3.7", () => {
			const v = parse("1.0.0-0.3.7");
			expect(v.prerelease).toEqual([0, 3, 7]);
		});

		it("parses 1.0.0-x.7.z.92", () => {
			const v = parse("1.0.0-x.7.z.92");
			expect(v.prerelease).toEqual(["x", 7, "z", 92]);
		});

		it("parses 1.0.0+build", () => {
			const v = parse("1.0.0+build");
			expect(v.build).toEqual(["build"]);
		});

		it("parses 1.0.0+build.001", () => {
			const v = parse("1.0.0+build.001");
			expect(v.build).toEqual(["build", "001"]);
		});

		it("parses 1.0.0-alpha.1+build.001", () => {
			const v = parse("1.0.0-alpha.1+build.001");
			expect(v.prerelease).toEqual(["alpha", 1]);
			expect(v.build).toEqual(["build", "001"]);
		});

		it("parses 1.0.0-rc.1+sha.abc123", () => {
			const v = parse("1.0.0-rc.1+sha.abc123");
			expect(v.prerelease).toEqual(["rc", 1]);
			expect(v.build).toEqual(["sha", "abc123"]);
		});

		it("parses 1.0.0-- (hyphen is alphanumeric identifier)", () => {
			const v = parse("1.0.0--");
			expect(v.prerelease).toEqual(["-"]);
		});

		it("parses 1.0.0--- (multiple hyphens)", () => {
			const v = parse("1.0.0---");
			expect(v.prerelease).toEqual(["--"]);
		});

		it("parses 1.0.0-0alpha (has letter, so alphanumeric)", () => {
			const v = parse("1.0.0-0alpha");
			expect(v.prerelease).toEqual(["0alpha"]);
		});

		it("parses 1.0.0-0-0 (has hyphen, so alphanumeric)", () => {
			const v = parse("1.0.0-0-0");
			expect(v.prerelease).toEqual(["0-0"]);
		});

		it("parses 1.0.0-alpha.-1 (hyphen in identifier)", () => {
			const v = parse("1.0.0-alpha.-1");
			expect(v.prerelease).toEqual(["alpha", "-1"]);
		});

		it("parses 1.0.0+001 (build allows leading zeros)", () => {
			const v = parse("1.0.0+001");
			expect(v.build).toEqual(["001"]);
		});

		it('trims whitespace: " 1.0.0 "', () => {
			const v = parse(" 1.0.0 ");
			expect(v.major).toBe(1);
			expect(v.minor).toBe(0);
			expect(v.patch).toBe(0);
		});
	});

	describe("invalid versions", () => {
		it("rejects empty string", () => {
			const err = getError("");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects v prefix: v1.0.0", () => {
			const err = getError("v1.0.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects V prefix: V1.0.0", () => {
			const err = getError("V1.0.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects missing components: 1.0", () => {
			const err = getError("1.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects missing components: 1", () => {
			const err = getError("1");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects leading zeros in major: 01.0.0", () => {
			const err = getError("01.0.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects leading zeros in minor: 1.02.0", () => {
			const err = getError("1.02.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects leading zeros in patch: 1.0.03", () => {
			const err = getError("1.0.03");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects leading zero in numeric prerelease: 1.0.0-01", () => {
			const err = getError("1.0.0-01");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects leading zero in numeric prerelease: 1.0.0-00", () => {
			const err = getError("1.0.0-00");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects second plus: 1.0.0+build+extra", () => {
			const err = getError("1.0.0+build+extra");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects empty prerelease identifier: 1.0.0-", () => {
			const err = getError("1.0.0-");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects empty build identifier: 1.0.0+", () => {
			const err = getError("1.0.0+");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects empty between dots in prerelease: 1.0.0-alpha..1", () => {
			const err = getError("1.0.0-alpha..1");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects equals prefix: =1.0.0", () => {
			const err = getError("=1.0.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});

		it("rejects too many components: 1.0.0.0", () => {
			const err = getError("1.0.0.0");
			expect(err).toBeInstanceOf(InvalidVersionError);
		});
	});
});
