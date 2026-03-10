import { Equal } from "effect";
import { describe, expect, it } from "vitest";
import { InvalidComparatorError } from "../src/errors/InvalidComparatorError.js";
import { InvalidPrereleaseError } from "../src/errors/InvalidPrereleaseError.js";
import { InvalidRangeError } from "../src/errors/InvalidRangeError.js";
import { InvalidVersionError } from "../src/errors/InvalidVersionError.js";

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
		const c = new InvalidVersionError({ input: "1.2.x", position: 5 });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, c)).toBe(false);
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
		const c = new InvalidRangeError({ input: ">=1.x" });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, c)).toBe(false);
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
		const c = new InvalidComparatorError({ input: ">>1.0.0", position: 2 });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, c)).toBe(false);
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
		const c = new InvalidPrereleaseError({ input: "beta@1" });
		expect(Equal.equals(a, b)).toBe(true);
		expect(Equal.equals(a, c)).toBe(false);
	});
});
