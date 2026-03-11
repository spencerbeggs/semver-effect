import { Effect, Layer } from "effect";
import { SemVerParser } from "../services/SemVerParser.js";
import { parseRangeSet, parseSingleComparator, parseValidSemVer } from "../utils/grammar.js";
import { normalizeRange } from "../utils/normalize.js";

/**
 * Live Effect {@link Layer} that provides the {@link SemVerParser} service.
 *
 * This layer has no dependencies and can be provided directly. It delegates to
 * the strict SemVer 2.0.0 recursive-descent parser implemented in the grammar
 * module, with range normalization applied to parsed range expressions.
 *
 * @example
 * ```typescript
 * import { SemVerParser, SemVerParserLive } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const parser = yield* SemVerParser;
 *   const v = yield* parser.parseVersion("1.0.0");
 * }).pipe(Effect.provide(SemVerParserLive));
 * ```
 *
 * @see {@link SemVerParser}
 * @see {@link https://effect.website/docs/context-management/layers | Effect Layers}
 */
export const SemVerParserLive: Layer.Layer<SemVerParser> = Layer.succeed(
	SemVerParser,
	SemVerParser.of({
		parseVersion: parseValidSemVer,
		parseRange: (input) => Effect.map(parseRangeSet(input), normalizeRange),
		parseComparator: parseSingleComparator,
	}),
);
