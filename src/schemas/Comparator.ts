import { Schema } from "effect";
import { SemVer } from "./SemVer.js";

export class Comparator extends Schema.TaggedClass<Comparator>()("Comparator", {
	operator: Schema.Literal("=", ">", ">=", "<", "<="),
	version: SemVer,
}) {
	toString(): string {
		const op = this.operator === "=" ? "" : this.operator;
		return `${op}${this.version.toString()}`;
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
