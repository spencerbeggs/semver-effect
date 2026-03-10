import { Data } from "effect";

/** @internal */
export const UnsatisfiedRangeErrorBase = Data.TaggedError("UnsatisfiedRangeError");

export class UnsatisfiedRangeError extends UnsatisfiedRangeErrorBase<{
	readonly range: unknown;
	readonly available: ReadonlyArray<unknown>;
}> {
	get message(): string {
		const count = this.available.length;
		return `No version satisfies range ${String(this.range)} (${count} version${count === 1 ? "" : "s"} available)`;
	}
}
