import type { Effect } from "effect";
import { Context } from "effect";
import type { InvalidComparatorError } from "../errors/InvalidComparatorError.js";
import type { InvalidRangeError } from "../errors/InvalidRangeError.js";
import type { InvalidVersionError } from "../errors/InvalidVersionError.js";
import type { Comparator } from "../schemas/Comparator.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";

export interface SemVerParser {
	readonly parseVersion: (input: string) => Effect.Effect<SemVer, InvalidVersionError>;
	readonly parseRange: (input: string) => Effect.Effect<Range, InvalidRangeError>;
	readonly parseComparator: (input: string) => Effect.Effect<Comparator, InvalidComparatorError>;
}

export const SemVerParser = Context.GenericTag<SemVerParser>("SemVerParser");
