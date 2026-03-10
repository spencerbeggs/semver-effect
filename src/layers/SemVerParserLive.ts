import { Effect, Layer } from "effect";
import { SemVerParser } from "../services/SemVerParser.js";
import { parseRangeSet, parseSingleComparator, parseValidSemVer } from "../utils/grammar.js";
import { normalizeRange } from "../utils/normalize.js";

export const SemVerParserLive: Layer.Layer<SemVerParser> = Layer.succeed(
	SemVerParser,
	SemVerParser.of({
		parseVersion: parseValidSemVer,
		parseRange: (input) => Effect.map(parseRangeSet(input), normalizeRange),
		parseComparator: parseSingleComparator,
	}),
);
