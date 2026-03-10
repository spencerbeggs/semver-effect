import { Data } from "effect";

/** @internal */
export const UnsatisfiableConstraintErrorBase = Data.TaggedError("UnsatisfiableConstraintError");

export class UnsatisfiableConstraintError extends UnsatisfiableConstraintErrorBase<{
	readonly constraints: ReadonlyArray<unknown>;
}> {
	get message(): string {
		const count = this.constraints.length;
		return `No version satisfies all ${count} constraint${count === 1 ? "" : "s"}`;
	}
}
