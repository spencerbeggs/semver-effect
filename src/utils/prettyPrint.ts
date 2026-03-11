import { Match } from "effect";
import type { Comparator } from "../schemas/Comparator.js";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";
import type { VersionDiff } from "../schemas/VersionDiff.js";

export type Printable = SemVer | Comparator | Range | VersionDiff;

const matcher = Match.type<Printable>().pipe(
	Match.tag("SemVer", (sv) => sv.toString()),
	Match.tag("Comparator", (c) => c.toString()),
	Match.tag("Range", (r) => r.toString()),
	Match.tag("VersionDiff", (d) => `${d.type} (${d.from.toString()} → ${d.to.toString()})`),
	Match.exhaustive,
);

export const prettyPrint = (value: Printable): string => matcher(value);
