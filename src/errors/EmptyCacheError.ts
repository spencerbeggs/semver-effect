import { Data } from "effect";

/** @internal */
export const EmptyCacheErrorBase = Data.TaggedError("EmptyCacheError");

export class EmptyCacheError extends EmptyCacheErrorBase {
	get message(): string {
		return "Version cache is empty";
	}
}
