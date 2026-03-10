import { Data } from "effect";

/** @internal */
export const VersionFetchErrorBase = Data.TaggedError("VersionFetchError");

export class VersionFetchError extends VersionFetchErrorBase<{
	readonly source: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}
