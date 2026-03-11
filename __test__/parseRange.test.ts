import { Cause, Chunk, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { InvalidComparatorError } from "../src/errors/InvalidComparatorError.js";
import { InvalidRangeError } from "../src/errors/InvalidRangeError.js";
import { parseRangeSet, parseSingleComparator } from "../src/utils/grammar.js";

const parseRange = (input: string) => Effect.runSync(parseRangeSet(input));
const parseComp = (input: string) => Effect.runSync(parseSingleComparator(input));

const getRangeError = (input: string): InvalidRangeError => {
	const exit = Effect.runSyncExit(parseRangeSet(input));
	if (Exit.isFailure(exit)) {
		const failures = Cause.failures(exit.cause);
		const first = Chunk.get(failures, 0);
		if (first._tag === "Some") {
			return first.value as InvalidRangeError;
		}
	}
	throw new Error("Expected failure");
};

const getCompError = (input: string): InvalidComparatorError => {
	const exit = Effect.runSyncExit(parseSingleComparator(input));
	if (Exit.isFailure(exit)) {
		const failures = Cause.failures(exit.cause);
		const first = Chunk.get(failures, 0);
		if (first._tag === "Some") {
			return first.value as InvalidComparatorError;
		}
	}
	throw new Error("Expected failure");
};

describe("parseSingleComparator", () => {
	it('parses ">=1.2.3"', () => {
		const c = parseComp(">=1.2.3");
		expect(c.operator).toBe(">=");
		expect(c.version.major).toBe(1);
		expect(c.version.minor).toBe(2);
		expect(c.version.patch).toBe(3);
	});

	it('parses "<2.0.0"', () => {
		const c = parseComp("<2.0.0");
		expect(c.operator).toBe("<");
		expect(c.version.major).toBe(2);
		expect(c.version.minor).toBe(0);
		expect(c.version.patch).toBe(0);
	});

	it('parses "1.2.3" as implicit equality', () => {
		const c = parseComp("1.2.3");
		expect(c.operator).toBe("=");
		expect(c.toString()).toBe("1.2.3");
	});

	it('parses "<=1.0.0-alpha.1" with prerelease', () => {
		const c = parseComp("<=1.0.0-alpha.1");
		expect(c.operator).toBe("<=");
		expect(c.version.prerelease).toEqual(["alpha", 1]);
	});

	it('parses ">0.0.0"', () => {
		const c = parseComp(">0.0.0");
		expect(c.operator).toBe(">");
		expect(c.version.major).toBe(0);
	});

	it('rejects ">>1.0.0" with InvalidComparatorError', () => {
		const err = getCompError(">>1.0.0");
		expect(err).toBeInstanceOf(InvalidComparatorError);
	});
});

describe("parseRangeSet", () => {
	describe("primitives", () => {
		it('parses ">=1.0.0" as single comparator', () => {
			const r = parseRange(">=1.0.0");
			expect(r.toString()).toBe(">=1.0.0");
		});

		it('parses ">=1.0.0 <2.0.0" as two comparators (AND)', () => {
			const r = parseRange(">=1.0.0 <2.0.0");
			expect(r.toString()).toBe(">=1.0.0 <2.0.0");
		});

		it('parses ">=1.0.0 || >=3.0.0" as two sets (OR)', () => {
			const r = parseRange(">=1.0.0 || >=3.0.0");
			expect(r.toString()).toBe(">=1.0.0 || >=3.0.0");
		});

		it('parses ">=1.0.0 <2.0.0 || >=3.0.0 <4.0.0" as complex OR+AND', () => {
			const r = parseRange(">=1.0.0 <2.0.0 || >=3.0.0 <4.0.0");
			expect(r.toString()).toBe(">=1.0.0 <2.0.0 || >=3.0.0 <4.0.0");
		});
	});

	describe("tilde ranges", () => {
		it('parses "~1.2.3" -> ">=1.2.3 <1.3.0-0"', () => {
			const r = parseRange("~1.2.3");
			expect(r.toString()).toBe(">=1.2.3 <1.3.0-0");
		});

		it('parses "~1.2" -> ">=1.2.0 <1.3.0-0"', () => {
			const r = parseRange("~1.2");
			expect(r.toString()).toBe(">=1.2.0 <1.3.0-0");
		});

		it('parses "~1" -> ">=1.0.0 <2.0.0-0"', () => {
			const r = parseRange("~1");
			expect(r.toString()).toBe(">=1.0.0 <2.0.0-0");
		});

		it('parses "~0.2.3" -> ">=0.2.3 <0.3.0-0"', () => {
			const r = parseRange("~0.2.3");
			expect(r.toString()).toBe(">=0.2.3 <0.3.0-0");
		});
	});

	describe("caret ranges", () => {
		it('parses "^1.2.3" -> ">=1.2.3 <2.0.0-0"', () => {
			const r = parseRange("^1.2.3");
			expect(r.toString()).toBe(">=1.2.3 <2.0.0-0");
		});

		it('parses "^0.2.3" -> ">=0.2.3 <0.3.0-0"', () => {
			const r = parseRange("^0.2.3");
			expect(r.toString()).toBe(">=0.2.3 <0.3.0-0");
		});

		it('parses "^0.0.3" -> ">=0.0.3 <0.0.4-0"', () => {
			const r = parseRange("^0.0.3");
			expect(r.toString()).toBe(">=0.0.3 <0.0.4-0");
		});

		it('parses "^1.2.x" -> ">=1.2.0 <2.0.0-0"', () => {
			const r = parseRange("^1.2.x");
			expect(r.toString()).toBe(">=1.2.0 <2.0.0-0");
		});

		it('parses "^0.0.x" -> ">=0.0.0 <0.1.0-0"', () => {
			const r = parseRange("^0.0.x");
			expect(r.toString()).toBe(">=0.0.0 <0.1.0-0");
		});

		it('parses "^0.0" -> ">=0.0.0 <0.1.0-0"', () => {
			const r = parseRange("^0.0");
			expect(r.toString()).toBe(">=0.0.0 <0.1.0-0");
		});

		it('parses "^1.x" -> ">=1.0.0 <2.0.0-0"', () => {
			const r = parseRange("^1.x");
			expect(r.toString()).toBe(">=1.0.0 <2.0.0-0");
		});

		it('parses "^0.x" -> ">=0.0.0 <1.0.0-0"', () => {
			const r = parseRange("^0.x");
			expect(r.toString()).toBe(">=0.0.0 <1.0.0-0");
		});
	});

	describe("x-ranges", () => {
		it('parses "*" -> ">=0.0.0"', () => {
			const r = parseRange("*");
			expect(r.toString()).toBe(">=0.0.0");
		});

		it('parses "1.x" -> ">=1.0.0 <2.0.0-0"', () => {
			const r = parseRange("1.x");
			expect(r.toString()).toBe(">=1.0.0 <2.0.0-0");
		});

		it('parses "1.2.x" -> ">=1.2.0 <1.3.0-0"', () => {
			const r = parseRange("1.2.x");
			expect(r.toString()).toBe(">=1.2.0 <1.3.0-0");
		});

		it('parses "" (empty) -> ">=0.0.0"', () => {
			const r = parseRange("");
			expect(r.toString()).toBe(">=0.0.0");
		});

		it('parses "1" -> same as "1.x.x"', () => {
			const r = parseRange("1");
			expect(r.toString()).toBe(">=1.0.0 <2.0.0-0");
		});

		it('parses "1.2" -> same as "1.2.x"', () => {
			const r = parseRange("1.2");
			expect(r.toString()).toBe(">=1.2.0 <1.3.0-0");
		});
	});

	describe("hyphen ranges", () => {
		it('parses "1.2.3 - 2.3.4" -> ">=1.2.3 <=2.3.4"', () => {
			const r = parseRange("1.2.3 - 2.3.4");
			expect(r.toString()).toBe(">=1.2.3 <=2.3.4");
		});

		it('parses "1.2 - 2.3.4" -> ">=1.2.0 <=2.3.4"', () => {
			const r = parseRange("1.2 - 2.3.4");
			expect(r.toString()).toBe(">=1.2.0 <=2.3.4");
		});

		it('parses "1.2.3 - 2.3" -> ">=1.2.3 <2.4.0-0"', () => {
			const r = parseRange("1.2.3 - 2.3");
			expect(r.toString()).toBe(">=1.2.3 <2.4.0-0");
		});

		it('parses "1.2.3 - 2" -> ">=1.2.3 <3.0.0-0"', () => {
			const r = parseRange("1.2.3 - 2");
			expect(r.toString()).toBe(">=1.2.3 <3.0.0-0");
		});
	});

	describe("rejected", () => {
		it('rejects "~>1.2.3" (Ruby-style tilde) with InvalidRangeError', () => {
			const err = getRangeError("~>1.2.3");
			expect(err).toBeInstanceOf(InvalidRangeError);
		});
	});

	describe("whitespace", () => {
		it('parses " >=1.0.0 " (trimmed, valid)', () => {
			const r = parseRange(" >=1.0.0 ");
			expect(r.toString()).toBe(">=1.0.0");
		});

		it('parses ">=1.0.0||<2.0.0" (|| without spaces)', () => {
			const r = parseRange(">=1.0.0||<2.0.0");
			expect(r.toString()).toBe(">=1.0.0 || <2.0.0");
		});

		it('parses ">=1.0.0  ||  <2.0.0" (extra spaces around ||)', () => {
			const r = parseRange(">=1.0.0  ||  <2.0.0");
			expect(r.toString()).toBe(">=1.0.0 || <2.0.0");
		});
	});
});
