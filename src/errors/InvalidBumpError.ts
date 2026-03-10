import { Data } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

/** @internal */
export const InvalidBumpErrorBase = Data.TaggedError("InvalidBumpError");

export class InvalidBumpError extends InvalidBumpErrorBase<{
	readonly version: SemVer;
	readonly type: string;
}> {
	get message(): string {
		return `Cannot apply ${this.type} bump to version ${this.version.toString()}`;
	}
}
