import { Data } from "effect";
import type { Range } from "../schemas/Range.js";
import type { SemVer } from "../schemas/SemVer.js";

/** @internal */
export const UnsatisfiedRangeErrorBase = Data.TaggedError("UnsatisfiedRangeError");

export class UnsatisfiedRangeError extends UnsatisfiedRangeErrorBase<{
	readonly range: Range;
	readonly available: ReadonlyArray<SemVer>;
}> {
	get message(): string {
		const count = this.available.length;
		return `No version satisfies range ${this.range.toString()} (${count} version${count === 1 ? "" : "s"} available)`;
	}
}
