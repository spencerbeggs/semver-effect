import { Data } from "effect";

/** @internal */
export const InvalidVersionErrorBase = Data.TaggedError("InvalidVersionError");

export class InvalidVersionError extends InvalidVersionErrorBase<{
	readonly input: string;
	readonly position?: number;
}> {
	get message(): string {
		const base = `Invalid version string: "${this.input}"`;
		return this.position !== undefined ? `${base} at position ${this.position}` : base;
	}
}
