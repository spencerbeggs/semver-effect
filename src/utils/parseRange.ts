import { Effect } from "effect";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import type { Range } from "../schemas/Range.js";
import { parseRangeSet } from "./grammar.js";
import { normalizeRange } from "./normalize.js";

/**
 * Parse a SemVer range expression string and normalize the result.
 *
 * This is a convenience function that performs the same parsing and normalization
 * as {@link SemVerParser.parseRange} but without requiring the service in scope.
 * Returns an {@link Effect.Effect} that fails with {@link InvalidRangeError}
 * on invalid input.
 *
 * Supports hyphen ranges (`1.0.0 - 2.0.0`), X-ranges (`1.x`, `*`), tilde
 * ranges (`~1.2.3`), caret ranges (`^1.2.3`), and `||`-separated unions.
 * All version components must be strictly valid SemVer 2.0.0 (no loose parsing).
 *
 * @example
 * ```typescript
 * import { parseRange, satisfies, parseVersion } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const range = yield* parseRange("^1.0.0");
 *   const v = yield* parseVersion("1.5.0");
 *   console.log(satisfies(v, range)); // true
 * });
 * ```
 *
 * @see {@link Range}
 * @see {@link SemVerParser}
 * @see {@link InvalidRangeError}
 */
export const parseRange = (input: string): Effect.Effect<Range, InvalidRangeError> =>
	Effect.map(parseRangeSet(input), normalizeRange);
