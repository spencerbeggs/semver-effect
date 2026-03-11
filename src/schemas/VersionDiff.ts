import { Data } from "effect";
import type { SemVer } from "./SemVer.js";

/** @internal */
export const VersionDiffBase = Data.TaggedClass("VersionDiff");

/**
 * The result of computing the difference between two {@link SemVer} versions.
 *
 * Contains the classification of the change (`type`) along with the signed
 * numeric deltas for `major`, `minor`, and `patch` fields. The `from` and `to`
 * fields preserve the original version objects.
 *
 * The `type` field indicates the highest-precedence field that differs:
 * - `"major"` — major versions differ
 * - `"minor"` — major is equal, minor versions differ
 * - `"patch"` — major and minor are equal, patch versions differ
 * - `"prerelease"` — only prerelease identifiers differ
 * - `"build"` — only build metadata differs
 * - `"none"` — versions are identical
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const a = yield* SemVer.fromString("1.2.3");
 *   const b = yield* SemVer.fromString("2.0.0");
 *   const d = SemVer.diff(a, b);
 *   console.log(d.type);  // "major"
 *   console.log(d.major); // 1
 * });
 * ```
 *
 * @see {@link diff}
 * @see {@link SemVer}
 */
export class VersionDiff extends VersionDiffBase<{
	readonly type: "major" | "minor" | "patch" | "prerelease" | "build" | "none";
	readonly from: SemVer;
	readonly to: SemVer;
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
}> {
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
