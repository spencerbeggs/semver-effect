import type { Effect } from "effect";
import { Context } from "effect";
import type { InvalidComparatorError } from "../errors/InvalidComparatorError.js";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import type { InvalidVersionError } from "../errors/InvalidVersionError.js";
import type { Comparator } from "../schemas/Comparator.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Effect service interface for parsing SemVer 2.0.0 strings.
 *
 * Provides effectful parsing of version strings, range expressions, and
 * individual comparators. All parsing is strict SemVer 2.0.0; no loose mode
 * or `v`-prefix coercion is supported.
 *
 * Use {@link SemVerParserLive} to provide a concrete implementation.
 *
 * @example
 * ```typescript
 * import { SemVerParser, SemVerParserLive } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const parser = yield* SemVerParser;
 *   const version = yield* parser.parseVersion("1.2.3");
 *   const range = yield* parser.parseRange("^1.0.0");
 *   const comp = yield* parser.parseComparator(">=2.0.0");
 * }).pipe(Effect.provide(SemVerParserLive));
 * ```
 *
 * @see {@link SemVerParserLive}
 * @see {@link https://effect.website/docs/context-management/services | Effect Services}
 */
export interface SemVerParser {
	/** Parse a string into a {@link SemVer}. Fails with {@link InvalidVersionError} on invalid input. */
	readonly parseVersion: (input: string) => Effect.Effect<SemVer, InvalidVersionError>;
	/** Parse a range expression into a {@link Range}. Fails with {@link InvalidRangeError} on invalid input. */
	readonly parseRange: (input: string) => Effect.Effect<Range, InvalidRangeError>;
	/** Parse a single comparator string into a {@link Comparator}. Fails with {@link InvalidComparatorError} on invalid input. */
	readonly parseComparator: (input: string) => Effect.Effect<Comparator, InvalidComparatorError>;
}

/**
 * Effect Context tag for the {@link SemVerParser} service.
 *
 * @see {@link SemVerParserLive}
 */
export const SemVerParser = Context.GenericTag<SemVerParser>("SemVerParser");
