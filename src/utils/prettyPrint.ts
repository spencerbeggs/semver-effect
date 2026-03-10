import { Comparator } from "../schemas/Comparator.js";
import { Range } from "../schemas/Range.js";
import { SemVer } from "../schemas/SemVer.js";
import { VersionDiff } from "../schemas/VersionDiff.js";

type Printable = SemVer | Comparator | Range | VersionDiff;

export const prettyPrint = (value: Printable): string => {
	if (value instanceof SemVer) {
		return value.toString();
	}
	if (value instanceof Comparator) {
		return value.toString();
	}
	if (value instanceof Range) {
		return value.toString();
	}
	if (value instanceof VersionDiff) {
		return `${value.type} (${value.from.toString()} \u2192 ${value.to.toString()})`;
	}
	return String(value);
};
