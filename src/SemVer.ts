import { Effect, Equivalence as Eq, ParseResult, Schema } from "effect";
import { SemVer, SemVerBase } from "./schemas/SemVer.js";
import { bumpMajor, bumpMinor, bumpPatch, bumpPrerelease, bumpRelease } from "./utils/bump.js";
import {
	compare,
	compareWithBuild,
	equal,
	gt,
	gte,
	isPrerelease,
	isStable,
	lt,
	lte,
	max,
	min,
	neq,
	rsort,
	sort,
	truncate,
} from "./utils/compare.js";
import { diff } from "./utils/diff.js";
import { parseValidSemVer } from "./utils/grammar.js";
import { SemVerOrder, SemVerOrderWithBuild } from "./utils/order.js";

// ---------------------------------------------------------------------------
// Re-export class + base
// ---------------------------------------------------------------------------

export { SemVer, SemVerBase };

// ---------------------------------------------------------------------------
// Convenience constructor
// ---------------------------------------------------------------------------

/**
 * Create a {@link SemVer} instance from individual components.
 */
export const make = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
): SemVer => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The zero version `0.0.0`. */
export const ZERO: SemVer = make(0, 0, 0);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parse a strict SemVer 2.0.0 string into a {@link SemVer}. */
export const fromString = parseValidSemVer;

// ---------------------------------------------------------------------------
// Comparison & predicates
// ---------------------------------------------------------------------------

export { compare, compareWithBuild, equal, gt, gte, lt, lte, neq };
export { isPrerelease, isStable };
export { truncate };

// ---------------------------------------------------------------------------
// Collection utilities
// ---------------------------------------------------------------------------

export { max, min, rsort, sort };

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export { diff };

// ---------------------------------------------------------------------------
// Bump sub-namespace
// ---------------------------------------------------------------------------

/**
 * Version bumping operations, grouped under a `bump` namespace.
 */
export const bump = {
	major: bumpMajor,
	minor: bumpMinor,
	patch: bumpPatch,
	prerelease: bumpPrerelease,
	release: bumpRelease,
} as const;

// ---------------------------------------------------------------------------
// Order & Equivalence
// ---------------------------------------------------------------------------

/** Effect `Order` for SemVer precedence (ignores build). */
export const Order = SemVerOrder;

/** Effect `Order` for SemVer precedence including build metadata. */
export const OrderWithBuild = SemVerOrderWithBuild;

/** Effect {@link Eq.Equivalence} for SemVer (ignores build metadata). */
export const Equivalence: Eq.Equivalence<SemVer> = Eq.make((self, that) => equal(self, that));

// ---------------------------------------------------------------------------
// Schema integration
// ---------------------------------------------------------------------------

/** Schema that validates a value is a {@link SemVer} instance. */
export const Instance: Schema.Schema<SemVer> = Schema.instanceOf(SemVer);

/**
 * Schema that decodes a string into a {@link SemVer} and encodes back to string.
 *
 * Useful with `Schema.Config`, `Schema.decodeUnknownSync`, etc.
 */
export const FromString: Schema.Schema<SemVer, string> = Schema.transformOrFail(Schema.String, Instance, {
	strict: true,
	decode: (s, _, ast) => fromString(s).pipe(Effect.mapError((e) => new ParseResult.Type(ast, s, e.message))),
	encode: (v) => Effect.succeed(v.toString()),
});
