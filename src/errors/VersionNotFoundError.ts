import { Data } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

/** @internal */
export const VersionNotFoundErrorBase = Data.TaggedError("VersionNotFoundError");

export class VersionNotFoundError extends VersionNotFoundErrorBase<{
	readonly version: SemVer;
}> {
	get message(): string {
		return `Version not found in cache: ${this.version.toString()}`;
	}
}
