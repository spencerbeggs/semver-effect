import { Data } from "effect";

/** @internal */
export const UnsatisfiedRangeErrorBase = Data.TaggedError("UnsatisfiedRangeError");

export class UnsatisfiedRangeError extends UnsatisfiedRangeErrorBase<{
	readonly range: unknown;
	readonly available: ReadonlyArray<unknown>;
}> {
	get message(): string {
		return `No version satisfies range ${String(this.range)} (${this.available.length} version(s) available)`;
	}
}
