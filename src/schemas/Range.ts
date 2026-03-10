import { Schema } from "effect";
import { Comparator } from "./Comparator.js";

export type ComparatorSet = ReadonlyArray<Comparator>;

export class Range extends Schema.TaggedClass<Range>()("Range", {
	sets: Schema.Array(Schema.Array(Comparator)),
}) {
	toString(): string {
		return this.sets.map((set) => set.map((c) => c.toString()).join(" ")).join(" || ");
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
