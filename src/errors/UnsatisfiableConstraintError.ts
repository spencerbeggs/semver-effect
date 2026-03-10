import { Data } from "effect";

/** @internal */
export const UnsatisfiableConstraintErrorBase = Data.TaggedError("UnsatisfiableConstraintError");

export class UnsatisfiableConstraintError extends UnsatisfiableConstraintErrorBase<{
	readonly constraints: ReadonlyArray<unknown>;
}> {
	get message(): string {
		return `No version satisfies all ${this.constraints.length} constraint(s)`;
	}
}
