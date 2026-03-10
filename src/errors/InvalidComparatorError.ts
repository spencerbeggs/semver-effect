import { Data } from "effect";

/** @internal */
export const InvalidComparatorErrorBase = Data.TaggedError("InvalidComparatorError");

export class InvalidComparatorError extends InvalidComparatorErrorBase<{
	readonly input: string;
	readonly position?: number;
}> {
	get message(): string {
		const base = `Invalid comparator: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}
