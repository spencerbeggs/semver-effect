import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionFetchError } from "../errors/VersionFetchError.js";
import type { SemVer } from "../schemas/SemVer.js";

export interface VersionFetcher {
	readonly fetch: (packageName: string) => Effect.Effect<ReadonlyArray<SemVer>, VersionFetchError>;
}

export const VersionFetcher = Context.GenericTag<VersionFetcher>("VersionFetcher");
