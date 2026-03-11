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

/**
 * Compute the difference between two {@link SemVer} versions.
 *
 * Returns a {@link VersionDiff} containing the type of change (major, minor,
 * patch, prerelease, build, or none) and signed numeric deltas for each field.
 *
 * @example
 * ```typescript
 * import { diff, parseVersion } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const a = yield* parseVersion("1.2.3");
 *   const b = yield* parseVersion("1.3.0");
 *   const d = diff(a, b);
 *   console.log(d.type);  // "minor"
 *   console.log(d.minor); // 1
 * });
 * ```
 *
 * @see {@link VersionDiff}
 */
export const diff: {
	(b: SemVer): (a: SemVer) => VersionDiff;
	(a: SemVer, b: SemVer): VersionDiff;
} = Fn.dual(
	2,
	(a: SemVer, b: SemVer): VersionDiff =>
		new VersionDiff({
			type: classifyDiff(a, b),
			from: a,
			to: b,
			major: b.major - a.major,
			minor: b.minor - a.minor,
			patch: b.patch - a.patch,
		}),
);
