import { Effect, ParseResult, Schema } from "effect";
import { Comparator } from "./schemas/Comparator.js";
import type { ComparatorSet } from "./schemas/Range.js";
import { Range, RangeBase } from "./schemas/Range.js";
import { SemVer } from "./schemas/SemVer.js";
import { equivalent, intersect, isSubset, simplify, union } from "./utils/algebra.js";
import { filter, maxSatisfying, minSatisfying, satisfies } from "./utils/matching.js";
import { parseRange } from "./utils/parseRange.js";

// ---------------------------------------------------------------------------
// Re-export class + base + type
// ---------------------------------------------------------------------------

export { Range, RangeBase };
export type { ComparatorSet };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parse a SemVer range expression string into a {@link Range}. */
export const fromString = parseRange;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A {@link Range} that matches any version (`>=0.0.0`). */
export const any: Range = new Range({
	sets: [
		[
			new Comparator({
				operator: ">=",
				version: new SemVer({ major: 0, minor: 0, patch: 0, prerelease: [], build: [] }),
			}),
		],
	],
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export { filter, maxSatisfying, minSatisfying, satisfies };

// ---------------------------------------------------------------------------
// Algebra
// ---------------------------------------------------------------------------

export { equivalent, intersect, isSubset, simplify, union };

// ---------------------------------------------------------------------------
// Schema integration
// ---------------------------------------------------------------------------

/** Schema that validates a value is a {@link Range} instance. */
export const Instance: Schema.Schema<Range> = Schema.instanceOf(Range);

/**
 * Schema that decodes a string into a {@link Range} and encodes back to string.
 *
 * Useful with `Schema.Config`, `Schema.decodeUnknownSync`, etc.
 */
export const FromString: Schema.Schema<Range, string> = Schema.transformOrFail(Schema.String, Instance, {
	strict: true,
	decode: (s, _, ast) => fromString(s).pipe(Effect.mapError((e) => new ParseResult.Type(ast, s, e.message))),
	encode: (v) => Effect.succeed(v.toString()),
});
