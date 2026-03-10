import { Data } from "effect";

/** @internal */
export const InvalidBumpErrorBase = Data.TaggedError("InvalidBumpError");

export class InvalidBumpError extends InvalidBumpErrorBase<{
	readonly version: unknown;
	readonly type: string;
}> {
	get message(): string {
		return `Cannot apply ${this.type} bump to version ${String(this.version)}`;
	}
}
