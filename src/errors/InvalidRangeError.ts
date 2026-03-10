import { Data } from "effect";

/** @internal */
export const InvalidRangeErrorBase = Data.TaggedError("InvalidRangeError");

export class InvalidRangeError extends InvalidRangeErrorBase<{
	readonly input: string;
	readonly position?: number;
}> {
	get message(): string {
		const base = `Invalid range expression: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}
