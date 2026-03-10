import { Schema } from "effect";
import { SemVer } from "./SemVer.js";

export class VersionDiff extends Schema.TaggedClass<VersionDiff>()("VersionDiff", {
	type: Schema.Literal("major", "minor", "patch", "prerelease", "build", "none"),
	from: SemVer,
	to: SemVer,
	major: Schema.Int,
	minor: Schema.Int,
	patch: Schema.Int,
}) {}
