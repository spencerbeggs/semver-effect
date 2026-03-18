import { Schema } from "effect";
import { SemVer } from "./SemVer.js";

/**
 * A single version constraint consisting of a comparison operator and a version.
 *
 * @example
 * ```typescript
 * import { Comparator } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const comp = yield* Comparator.parse(">=1.2.3");
 *   console.log(comp.operator);               // ">="
 *   console.log(comp.version.toString());      // "1.2.3"
 *   console.log(comp.test(new SemVer({ major: 2, minor: 0, patch: 0, prerelease: [], build: [] }))); // true
 * });
 * ```
 *
 * @see {@link Range}
 * @see {@link SemVer}
 */
export class Comparator extends Schema.TaggedClass<Comparator>()("Comparator", {
	operator: Schema.Literal("=", ">", ">=", "<", "<="),
	version: SemVer,
}) {
	// ── Cross-cutting statics (wired in index.ts) ───────────────────────

	/** Parse a comparator string (e.g. `">=1.2.3"`). Wired at module load by index.ts. */
	static parse: (
		input: string,
	) => import("effect/Effect").Effect<Comparator, import("../errors/InvalidComparatorError.js").InvalidComparatorError>;

	// ── Instance methods ────────────────────────────────────────────────

	/** Test whether a version satisfies this comparator. */
	test(version: SemVer): boolean {
		const cmp = version.compare(this.version);
		switch (this.operator) {
			case "=":
				return cmp === 0;
			case ">":
				return cmp > 0;
			case ">=":
				return cmp >= 0;
			case "<":
				return cmp < 0;
			case "<=":
				return cmp <= 0;
		}
	}

	// ── Display ─────────────────────────────────────────────────────────

	toString(): string {
		const op = this.operator === "=" ? "" : this.operator;
		return `${op}${this.version.toString()}`;
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
