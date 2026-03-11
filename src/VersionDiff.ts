import { Schema } from "effect";
import type { SemVer } from "./schemas/SemVer.js";
import { VersionDiff, VersionDiffBase } from "./schemas/VersionDiff.js";

// ── Re-export class ──────────────────────────────────────────────────

export { VersionDiff };
/** @internal */
export { VersionDiffBase };

// ---------------------------------------------------------------------------
// Convenience constructor
// ---------------------------------------------------------------------------

/**
 * Create a {@link VersionDiff} from individual components.
 */
export const make = (
	type: "major" | "minor" | "patch" | "prerelease" | "build" | "none",
	from: SemVer,
	to: SemVer,
	major: number,
	minor: number,
	patch: number,
): VersionDiff => new VersionDiff({ type, from, to, major, minor, patch });

// ---------------------------------------------------------------------------
// Schema integration
// ---------------------------------------------------------------------------

/** Schema that validates a value is a {@link VersionDiff} instance. */
export const Instance: Schema.Schema<VersionDiff> = Schema.instanceOf(VersionDiff);
