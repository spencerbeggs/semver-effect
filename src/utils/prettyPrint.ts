import { Match } from "effect";
import type { Comparator } from "../schemas/Comparator.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";
import type { VersionDiff } from "../schemas/VersionDiff.js";

/**
 * Union of all schema types that can be pretty-printed by {@link prettyPrint}.
 *
 * @see {@link prettyPrint}
 */
export type Printable = SemVer | Comparator | Range | VersionDiff;

const matcher = Match.type<Printable>().pipe(
	Match.tag("SemVer", (sv) => sv.toString()),
	Match.tag("Comparator", (c) => c.toString()),
	Match.tag("Range", (r) => r.toString()),
	Match.tag("VersionDiff", (d) => d.toString()),
	Match.exhaustive,
);

/**
 * Convert any {@link Printable} schema value to its human-readable string form.
 *
 * Dispatches on the `_tag` field to call the appropriate `toString()` method.
 * This is a convenience for logging and display; each schema type also has its
 * own `toString()` method.
 *
 * @example
 * ```typescript
 * import { PrettyPrint, SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.fromString("1.2.3-alpha.1");
 *   console.log(PrettyPrint.prettyPrint(v)); // "1.2.3-alpha.1"
 * });
 * ```
 *
 * @see {@link Printable}
 */
export const prettyPrint = (value: Printable): string => matcher(value);
