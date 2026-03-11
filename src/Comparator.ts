import { Effect, ParseResult, Schema } from "effect";
import { Comparator, ComparatorBase } from "./schemas/Comparator.js";
import { SemVer } from "./schemas/SemVer.js";
import { parseSingleComparator } from "./utils/grammar.js";

// ---------------------------------------------------------------------------
// Re-export class + base
// ---------------------------------------------------------------------------

export { Comparator, ComparatorBase };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parse a single comparator string (e.g. `">=1.2.3"`) into a {@link Comparator}. */
export const fromString = parseSingleComparator;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A {@link Comparator} matching any version (`>=0.0.0`). */
export const any: Comparator = new Comparator({
	operator: ">=",
	version: new SemVer({ major: 0, minor: 0, patch: 0, prerelease: [], build: [] }),
});

// ---------------------------------------------------------------------------
// Schema integration
// ---------------------------------------------------------------------------

/** Schema that validates a value is a {@link Comparator} instance. */
export const Instance: Schema.Schema<Comparator> = Schema.instanceOf(Comparator);

/**
 * Schema that decodes a string into a {@link Comparator} and encodes back to string.
 *
 * Useful with `Schema.Config`, `Schema.decodeUnknownSync`, etc.
 */
export const FromString: Schema.Schema<Comparator, string> = Schema.transformOrFail(Schema.String, Instance, {
	strict: true,
	decode: (s, _, ast) => fromString(s).pipe(Effect.mapError((e) => new ParseResult.Type(ast, s, e.message))),
	encode: (v) => Effect.succeed(v.toString()),
});
