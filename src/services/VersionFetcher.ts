import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionFetchError } from "../errors/VersionFetchError.js";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Effect service interface for fetching available versions from an external source.
 *
 * Implementations might query a package registry (e.g., npm, GitHub Releases) and
 * return parsed {@link SemVer} instances. This is an interface-only service; no
 * default live layer is provided by this library -- consumers must supply their own.
 *
 * @example
 * ```typescript
 * import type { VersionFetcher } from "semver-effect";
 * import { Effect, Layer } from "effect";
 *
 * // Example: a stub implementation
 * const StubFetcher = Layer.succeed(VersionFetcher, {
 *   fetch: (_packageName) => Effect.succeed([]),
 * });
 * ```
 *
 * @see {@link VersionFetchError}
 * @see {@link VersionCache}
 * @see {@link https://effect.website/docs/context-management/services | Effect Services}
 */
export interface VersionFetcher {
	/** Fetch all available versions for the given package name. Fails with {@link VersionFetchError} on failure. */
	readonly fetch: (packageName: string) => Effect.Effect<ReadonlyArray<SemVer>, VersionFetchError>;
}

/**
 * Effect Context tag for the {@link VersionFetcher} service.
 */
export const VersionFetcher = Context.GenericTag<VersionFetcher>("VersionFetcher");
