import { Schema } from "effect";
import { SemVer } from "./SemVer.js";

export class VersionDiff extends Schema.TaggedClass<VersionDiff>()("VersionDiff", {
	type: Schema.Literal("major", "minor", "patch", "prerelease", "build", "none"),
	from: SemVer,
	to: SemVer,
	major: Schema.Int,
	minor: Schema.Int,
	patch: Schema.Int,
}) {
	toString(): string {
		return `${this.type} (${this.from.toString()} → ${this.to.toString()})`;
	}

	toJSON(): unknown {
		return {
			_tag: "VersionDiff" as const,
			type: this.type,
			from: this.from.toJSON(),
			to: this.to.toJSON(),
			major: this.major,
			minor: this.minor,
			patch: this.patch,
		};
	}
}
