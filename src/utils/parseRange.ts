import { Effect } from "effect";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import type { Range } from "../schemas/Range.js";
import { parseRangeSet } from "./grammar.js";
import { normalizeRange } from "./normalize.js";

/**
 * Parse a range expression and normalize the result.
 * Convenience function that applies the same normalization
 * as the SemVerParser service.
 */
export const parseRange = (input: string): Effect.Effect<Range, InvalidRangeError> =>
	Effect.map(parseRangeSet(input), normalizeRange);
