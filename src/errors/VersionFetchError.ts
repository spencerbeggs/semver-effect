import { Data } from "effect";

/**
 * Tagged error base for {@link VersionFetchError}.
 *
 * @privateRemarks
 * Exported because TypeScript declaration bundling requires the base class to be
 * accessible when `VersionFetchError` appears in public type signatures.
 * Consumers should use {@link VersionFetchError} directly.
 *
 * @internal
 */
export const VersionFetchErrorBase = Data.TaggedError("VersionFetchError");

/**
 * Indicates that fetching versions from an external source failed.
 *
 * Returned by {@link VersionFetcher} implementations when a network request or
 * registry lookup fails. The `source` field identifies the registry or endpoint,
 * and `cause` may contain the underlying error.
 *
 * @see {@link VersionFetcher}
 */
export class VersionFetchError extends VersionFetchErrorBase<{
	/** The source identifier (e.g., registry URL or package name). */
	readonly source: string;
	/** A human-readable description of the failure. */
	readonly message: string;
	/** The underlying error, if any. */
	readonly cause?: unknown;
}> {}
