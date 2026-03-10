import { Data } from "effect";

/** @internal */
export const InvalidPrereleaseErrorBase = Data.TaggedError("InvalidPrereleaseError");

export class InvalidPrereleaseError extends InvalidPrereleaseErrorBase<{
	readonly input: string;
}> {
	get message(): string {
		return `Invalid prerelease identifier: "${this.input}"`;
	}
}
