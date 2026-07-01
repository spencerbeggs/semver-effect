import type { SemVer } from "../schemas/SemVer.js";

/**
 * Increment the major version and reset minor, patch, and prerelease to zero/empty.
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.2.3");
 *   console.log(v.bump.major().toString()); // "2.0.0"
 * });
 * ```
 *
 * @see {@link bumpMinor}
 * @see {@link bumpPatch}
 * @public
 */
export const bumpMajor = (v: SemVer): SemVer => v.bump.major();

/**
 * Increment the minor version and reset patch and prerelease to zero/empty.
 *
 * @see {@link bumpMajor}
 * @see {@link bumpPatch}
 * @public
 */
export const bumpMinor = (v: SemVer): SemVer => v.bump.minor();

/**
 * Increment the patch version and clear prerelease identifiers.
 *
 * @see {@link bumpMajor}
 * @see {@link bumpMinor}
 * @public
 */
export const bumpPatch = (v: SemVer): SemVer => v.bump.patch();

/**
 * Increment the prerelease portion of a version.
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
 *   const v = yield* SemVer.parse("1.0.0-alpha.3");
 *   console.log(v.bump.prerelease("alpha").toString()); // "1.0.0-alpha.4"
 *   console.log(v.bump.prerelease("beta").toString());  // "1.0.0-beta.0"
 * });
 * ```
 *
 * @see {@link bumpRelease}
 * @public
 */
export const bumpPrerelease = (v: SemVer, id?: string): SemVer => v.bump.prerelease(id);

/**
 * Strip prerelease and build metadata, promoting a prerelease to its release version.
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.2.3-rc.1");
 *   console.log(v.bump.release().toString()); // "1.2.3"
 * });
 * ```
 *
 * @see {@link bumpPrerelease}
 * @public
 */
export const bumpRelease = (v: SemVer): SemVer => v.bump.release();
