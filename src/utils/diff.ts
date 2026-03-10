import { Function as Fn } from "effect";
import type { SemVer } from "../schemas/SemVer.js";
import { VersionDiff } from "../schemas/VersionDiff.js";

const arraysEqual = (a: ReadonlyArray<string | number>, b: ReadonlyArray<string | number>): boolean =>
	a.length === b.length && a.every((v, i) => v === b[i]);

const classifyDiff = (a: SemVer, b: SemVer): "major" | "minor" | "patch" | "prerelease" | "build" | "none" => {
	if (a.major !== b.major) return "major";
	if (a.minor !== b.minor) return "minor";
	if (a.patch !== b.patch) return "patch";
	if (!arraysEqual(a.prerelease, b.prerelease)) return "prerelease";
	if (!arraysEqual(a.build, b.build)) return "build";
	return "none";
};

export const diff: {
	(b: SemVer): (a: SemVer) => VersionDiff;
	(a: SemVer, b: SemVer): VersionDiff;
} = Fn.dual(
	2,
	(a: SemVer, b: SemVer): VersionDiff =>
		new VersionDiff(
			{
				type: classifyDiff(a, b),
				from: a,
				to: b,
				major: b.major - a.major,
				minor: b.minor - a.minor,
				patch: b.patch - a.patch,
			},
			{ disableValidation: true },
		),
);
