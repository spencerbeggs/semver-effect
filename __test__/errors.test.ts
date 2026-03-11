import { Equal } from "effect";
import { describe, expect, it } from "vitest";
import * as Comparator from "../src/Comparator.js";
import { EmptyCacheError } from "../src/errors/EmptyCacheError.js";
import { InvalidBumpError } from "../src/errors/InvalidBumpError.js";
import { InvalidComparatorError } from "../src/errors/InvalidComparatorError.js";
import { InvalidPrereleaseError } from "../src/errors/InvalidPrereleaseError.js";
import { InvalidRangeError } from "../src/errors/InvalidRangeError.js";
import { InvalidVersionError } from "../src/errors/InvalidVersionError.js";
import { UnsatisfiableConstraintError } from "../src/errors/UnsatisfiableConstraintError.js";
import { UnsatisfiedRangeError } from "../src/errors/UnsatisfiedRangeError.js";
import { VersionFetchError } from "../src/errors/VersionFetchError.js";
import { VersionNotFoundError } from "../src/errors/VersionNotFoundError.js";
import * as Range from "../src/Range.js";
import * as SemVer from "../src/SemVer.js";

const v = (major: number, minor: number, patch: number) => SemVer.make(major, minor, patch);

const c = (operator: "=" | ">" | ">=" | "<" | "<=", version: SemVer.SemVer) =>
	new Comparator.Comparator({ operator, version });

const r = (sets: ReadonlyArray<ReadonlyArray<Comparator.Comparator>> = []) =>
	new Range.Range({ sets: [...sets.map((s) => [...s])] });

describe("InvalidVersionError", () => {
	it("has the correct _tag", () => {
		const err = new InvalidVersionError({ input: "bad" });
		expect(err._tag).toBe("InvalidVersionError");
	});

	it("exposes the input field", () => {
		const err = new InvalidVersionError({ input: "1.2.x" });
		expect(err.input).toBe("1.2.x");
	});

	it("exposes undefined position when not provided", () => {
		const err = new InvalidVersionError({ input: "1.2.x" });
		expect(err.position).toBeUndefined();
	});

	it("exposes the position field when provided", () => {
		const err = new InvalidVersionError({ input: "1.2.x", position: 4 });
		expect(err.position).toBe(4);
	});

	it("derives message without position", () => {
		const err = new InvalidVersionError({ input: "1.2.x" });
		expect(err.message).toBe('Invalid version string: "1.2.x"');
	});

	it("derives message with position", () => {
		const err = new InvalidVersionError({ input: "1.2.x", position: 4 });
		expect(err.message).toBe('Invalid version string: "1.2.x" at position 4');
	});

	it("is an instance of Error", () => {
		const err = new InvalidVersionError({ input: "bad" });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new InvalidVersionError({ input: "1.2.x", position: 4 });
		const b = new InvalidVersionError({ input: "1.2.x", position: 4 });
		const d = new InvalidVersionError({ input: "1.2.x", position: 5 });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("InvalidRangeError", () => {
	it("has the correct _tag", () => {
		const err = new InvalidRangeError({ input: "bad" });
		expect(err._tag).toBe("InvalidRangeError");
	});

	it("exposes the input field", () => {
		const err = new InvalidRangeError({ input: ">=1.x" });
		expect(err.input).toBe(">=1.x");
	});

	it("exposes undefined position when not provided", () => {
		const err = new InvalidRangeError({ input: ">=1.x" });
		expect(err.position).toBeUndefined();
	});

	it("exposes the position field when provided", () => {
		const err = new InvalidRangeError({ input: ">=1.x", position: 3 });
		expect(err.position).toBe(3);
	});

	it("derives message without position", () => {
		const err = new InvalidRangeError({ input: ">=1.x" });
		expect(err.message).toBe('Invalid range expression: ">=1.x"');
	});

	it("derives message with position", () => {
		const err = new InvalidRangeError({ input: ">=1.x", position: 3 });
		expect(err.message).toBe('Invalid range expression: ">=1.x" at position 3');
	});

	it("is an instance of Error", () => {
		const err = new InvalidRangeError({ input: "bad" });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new InvalidRangeError({ input: ">=1.x", position: 3 });
		const b = new InvalidRangeError({ input: ">=1.x", position: 3 });
		const d = new InvalidRangeError({ input: ">=1.x" });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("InvalidComparatorError", () => {
	it("has the correct _tag", () => {
		const err = new InvalidComparatorError({ input: "bad" });
		expect(err._tag).toBe("InvalidComparatorError");
	});

	it("exposes the input field", () => {
		const err = new InvalidComparatorError({ input: ">>1.0.0" });
		expect(err.input).toBe(">>1.0.0");
	});

	it("exposes undefined position when not provided", () => {
		const err = new InvalidComparatorError({ input: ">>1.0.0" });
		expect(err.position).toBeUndefined();
	});

	it("exposes the position field when provided", () => {
		const err = new InvalidComparatorError({ input: ">>1.0.0", position: 1 });
		expect(err.position).toBe(1);
	});

	it("derives message without position", () => {
		const err = new InvalidComparatorError({ input: ">>1.0.0" });
		expect(err.message).toBe('Invalid comparator: ">>1.0.0"');
	});

	it("derives message with position", () => {
		const err = new InvalidComparatorError({ input: ">>1.0.0", position: 1 });
		expect(err.message).toBe('Invalid comparator: ">>1.0.0" at position 1');
	});

	it("is an instance of Error", () => {
		const err = new InvalidComparatorError({ input: "bad" });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new InvalidComparatorError({ input: ">>1.0.0", position: 1 });
		const b = new InvalidComparatorError({ input: ">>1.0.0", position: 1 });
		const d = new InvalidComparatorError({ input: ">>1.0.0", position: 2 });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("InvalidPrereleaseError", () => {
	it("has the correct _tag", () => {
		const err = new InvalidPrereleaseError({ input: "bad!" });
		expect(err._tag).toBe("InvalidPrereleaseError");
	});

	it("exposes the input field", () => {
		const err = new InvalidPrereleaseError({ input: "alpha@1" });
		expect(err.input).toBe("alpha@1");
	});

	it("has no position field", () => {
		const err = new InvalidPrereleaseError({ input: "alpha@1" });
		expect("position" in err).toBe(false);
	});

	it("derives message", () => {
		const err = new InvalidPrereleaseError({ input: "alpha@1" });
		expect(err.message).toBe('Invalid prerelease identifier: "alpha@1"');
	});

	it("is an instance of Error", () => {
		const err = new InvalidPrereleaseError({ input: "bad!" });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new InvalidPrereleaseError({ input: "alpha@1" });
		const b = new InvalidPrereleaseError({ input: "alpha@1" });
		const d = new InvalidPrereleaseError({ input: "beta@1" });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("UnsatisfiedRangeError", () => {
	const range = r([[c(">=", v(2, 0, 0))]]);
	const available: ReadonlyArray<SemVer.SemVer> = [];

	it("has the correct _tag", () => {
		const err = new UnsatisfiedRangeError({ range, available });
		expect(err._tag).toBe("UnsatisfiedRangeError");
	});

	it("exposes the range field", () => {
		const err = new UnsatisfiedRangeError({ range, available });
		expect(err.range).toBe(range);
	});

	it("exposes the available field", () => {
		const versions: ReadonlyArray<SemVer.SemVer> = [v(1, 0, 0), v(1, 5, 0)];
		const err = new UnsatisfiedRangeError({ range, available: versions });
		expect(err.available).toBe(versions);
	});

	it("derives message with version count", () => {
		const err = new UnsatisfiedRangeError({
			range,
			available: [v(1, 0, 0), v(1, 5, 0)],
		});
		expect(err.message).toBe("No version satisfies range >=2.0.0 (2 versions available)");
	});

	it("is an instance of Error", () => {
		const err = new UnsatisfiedRangeError({ range, available });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new UnsatisfiedRangeError({ range, available });
		const b = new UnsatisfiedRangeError({ range, available });
		const otherRange = r([[c(">=", v(3, 0, 0))]]);
		const d = new UnsatisfiedRangeError({ range: otherRange, available });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("VersionNotFoundError", () => {
	const version = v(1, 2, 3);

	it("has the correct _tag", () => {
		const err = new VersionNotFoundError({ version });
		expect(err._tag).toBe("VersionNotFoundError");
	});

	it("exposes the version field", () => {
		const err = new VersionNotFoundError({ version });
		expect(err.version).toBe(version);
	});

	it("derives message", () => {
		const err = new VersionNotFoundError({ version });
		expect(err.message).toBe("Version not found in cache: 1.2.3");
	});

	it("is an instance of Error", () => {
		const err = new VersionNotFoundError({ version });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new VersionNotFoundError({ version: v(1, 2, 3) });
		const b = new VersionNotFoundError({ version: v(1, 2, 3) });
		const d = new VersionNotFoundError({ version: v(2, 0, 0) });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("EmptyCacheError", () => {
	it("has the correct _tag", () => {
		const err = new EmptyCacheError();
		expect(err._tag).toBe("EmptyCacheError");
	});

	it("derives message", () => {
		const err = new EmptyCacheError();
		expect(err.message).toBe("Version cache is empty");
	});

	it("is an instance of Error", () => {
		const err = new EmptyCacheError();
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new EmptyCacheError();
		const b = new EmptyCacheError();
		expect(Equal.equals(a, b)).toBe(true);
	});
});

describe("UnsatisfiableConstraintError", () => {
	const constraints: ReadonlyArray<Range.Range> = [];

	it("has the correct _tag", () => {
		const err = new UnsatisfiableConstraintError({ constraints });
		expect(err._tag).toBe("UnsatisfiableConstraintError");
	});

	it("exposes the constraints field", () => {
		const cs: ReadonlyArray<Range.Range> = [r([[c(">=", v(1, 0, 0))]]), r([[c("<", v(2, 0, 0))]])];
		const err = new UnsatisfiableConstraintError({ constraints: cs });
		expect(err.constraints).toBe(cs);
	});

	it("derives message with constraint count", () => {
		const err = new UnsatisfiableConstraintError({
			constraints: [r([[c(">=", v(1, 0, 0))]]), r([[c("<", v(2, 0, 0))]]), r([[c("=", v(1, 5, 0))]])],
		});
		expect(err.message).toBe("No version satisfies all 3 constraints");
	});

	it("is an instance of Error", () => {
		const err = new UnsatisfiableConstraintError({ constraints });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const sharedConstraints: ReadonlyArray<Range.Range> = [r([[c(">=", v(1, 0, 0))]])];
		const a = new UnsatisfiableConstraintError({ constraints: sharedConstraints });
		const b = new UnsatisfiableConstraintError({ constraints: sharedConstraints });
		const d = new UnsatisfiableConstraintError({ constraints: [r([[c(">=", v(2, 0, 0))]])] });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("InvalidBumpError", () => {
	const version = v(1, 2, 3);

	it("has the correct _tag", () => {
		const err = new InvalidBumpError({ version, type: "major" });
		expect(err._tag).toBe("InvalidBumpError");
	});

	it("exposes the version field", () => {
		const err = new InvalidBumpError({ version, type: "major" });
		expect(err.version).toBe(version);
	});

	it("exposes the type field", () => {
		const err = new InvalidBumpError({ version, type: "major" });
		expect(err.type).toBe("major");
	});

	it("derives message", () => {
		const err = new InvalidBumpError({ version, type: "major" });
		expect(err.message).toBe("Cannot apply major bump to version 1.2.3");
	});

	it("is an instance of Error", () => {
		const err = new InvalidBumpError({ version, type: "major" });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new InvalidBumpError({ version: v(1, 2, 3), type: "major" });
		const b = new InvalidBumpError({ version: v(1, 2, 3), type: "major" });
		const d = new InvalidBumpError({ version: v(1, 2, 3), type: "minor" });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});

describe("VersionFetchError", () => {
	it("has the correct _tag", () => {
		const err = new VersionFetchError({ source: "npm", message: "Network timeout" });
		expect(err._tag).toBe("VersionFetchError");
	});

	it("exposes the source field", () => {
		const err = new VersionFetchError({ source: "npm", message: "Network timeout" });
		expect(err.source).toBe("npm");
	});

	it("exposes the message field", () => {
		const err = new VersionFetchError({ source: "npm", message: "Network timeout" });
		expect(err.message).toBe("Network timeout");
	});

	it("exposes undefined cause when not provided", () => {
		const err = new VersionFetchError({ source: "npm", message: "Network timeout" });
		expect(err.cause).toBeUndefined();
	});

	it("exposes cause when provided", () => {
		const cause = new Error("socket hang up");
		const err = new VersionFetchError({ source: "npm", message: "Network timeout", cause });
		expect(err.cause).toBe(cause);
	});

	it("is an instance of Error", () => {
		const err = new VersionFetchError({ source: "npm", message: "Network timeout" });
		expect(err).toBeInstanceOf(Error);
	});

	it("supports structural equality via Equal.equals", () => {
		const a = new VersionFetchError({ source: "npm", message: "Network timeout" });
		const b = new VersionFetchError({ source: "npm", message: "Network timeout" });
		const d = new VersionFetchError({ source: "github", message: "Network timeout" });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, d)).toBe(false);
	});
});
