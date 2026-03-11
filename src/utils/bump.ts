import { SemVer } from "../schemas/SemVer.js";

const sv = (major: number, minor: number, patch: number, prerelease: ReadonlyArray<string | number> = []): SemVer =>
	new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [] });

/**
 * Increment the major version and reset minor, patch, and prerelease to zero/empty.
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.fromString("1.2.3");
 *   console.log(SemVer.bump.major(v).toString()); // "2.0.0"
 * });
 * ```
 *
 * @see {@link bumpMinor}
 * @see {@link bumpPatch}
 */
export const bumpMajor = (v: SemVer): SemVer => sv(v.major + 1, 0, 0);

/**
 * Increment the minor version and reset patch and prerelease to zero/empty.
 *
 * @see {@link bumpMajor}
 * @see {@link bumpPatch}
 */
export const bumpMinor = (v: SemVer): SemVer => sv(v.major, v.minor + 1, 0);

/**
 * Increment the patch version and clear prerelease identifiers.
 *
 * @see {@link bumpMajor}
 * @see {@link bumpMinor}
 */
export const bumpPatch = (v: SemVer): SemVer => sv(v.major, v.minor, v.patch + 1);

/**
 * Increment the prerelease portion of a version.
 *
 * Behavior depends on the current state:
 * - **No prerelease**: bumps patch and adds `[id, 0]` (or `[0]` if no `id`).
 * - **Has prerelease, different `id`**: resets to `[id, 0]` on the same `major.minor.patch`.
 * - **Has prerelease, same `id` (or no `id`)**: increments the last numeric identifier,
 *   or appends `0` if the last identifier is a string.
 *
 * @param v - The version to bump.
 * @param id - Optional prerelease identifier prefix (e.g., `"alpha"`, `"beta"`).
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.fromString("1.0.0-alpha.3");
 *   console.log(SemVer.bump.prerelease(v, "alpha").toString()); // "1.0.0-alpha.4"
 *   console.log(SemVer.bump.prerelease(v, "beta").toString());  // "1.0.0-beta.0"
 * });
 * ```
 *
 * @see {@link bumpRelease}
 */
export const bumpPrerelease = (v: SemVer, id?: string): SemVer => {
	const pre = v.prerelease;

	if (pre.length === 0) {
		// No prerelease: bump patch and add prerelease
		return id !== undefined ? sv(v.major, v.minor, v.patch + 1, [id, 0]) : sv(v.major, v.minor, v.patch + 1, [0]);
	}

	// Has prerelease
	if (id !== undefined) {
		// Check if current prefix matches
		const currentPrefix = typeof pre[0] === "string" ? pre[0] : null;
		if (currentPrefix !== id) {
			// Different prefix: reset
			return sv(v.major, v.minor, v.patch, [id, 0]);
		}
	}

	// Increment last numeric, or append 0
	const last = pre[pre.length - 1];
	if (typeof last === "number") {
		const newPre = [...pre];
		newPre[newPre.length - 1] = last + 1;
		return sv(v.major, v.minor, v.patch, newPre);
	}

	// Last is string: append 0
	return sv(v.major, v.minor, v.patch, [...pre, 0]);
};

/**
 * Strip prerelease and build metadata, promoting a prerelease to its release version.
 *
 * For a version like `1.2.3-alpha.1`, returns `1.2.3`. For a version that is
 * already a release, returns a copy with the same `major.minor.patch`.
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.fromString("1.2.3-rc.1");
 *   console.log(SemVer.bump.release(v).toString()); // "1.2.3"
 * });
 * ```
 *
 * @see {@link bumpPrerelease}
 */
export const bumpRelease = (v: SemVer): SemVer => sv(v.major, v.minor, v.patch);
