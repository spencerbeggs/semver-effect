import { Data } from "effect";

/** @internal */
export const VersionNotFoundErrorBase = Data.TaggedError("VersionNotFoundError");

export class VersionNotFoundError extends VersionNotFoundErrorBase<{
	readonly version: unknown;
}> {
	get message(): string {
		return `Version not found in cache: ${String(this.version)}`;
	}
}
