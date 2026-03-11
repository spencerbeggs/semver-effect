import { Data, Equal, Hash } from "effect";

/** @internal */
export const SemVerBase = Data.TaggedClass("SemVer");

/**
 * A parsed SemVer 2.0.0 version, represented as an Effect `Data.TaggedClass`.
 *
 * Implements structural equality via {@link Equal.Equal} (build metadata is
 * excluded from equality checks per the SemVer spec) and is hashable via
 * {@link Hash.Hash}.
 *
 * @remarks
 * All numeric fields (`major`, `minor`, `patch`) must be non-negative integers.
 * Prerelease identifiers may be strings or non-negative integers. Build metadata
 * identifiers are always strings. Build metadata is preserved but ignored in all
 * comparison and equality operations, per SemVer 2.0.0 section 10.
 *
 * Unlike node-semver, this implementation does not support loose parsing or
 * `v`-prefixed strings. Only strictly valid SemVer 2.0.0 strings are accepted.
 *
 * @example
 * ```typescript
 * import type { SemVer } from "semver-effect";
 * import { parseVersion } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v: SemVer = yield* parseVersion("1.2.3-alpha.1+build.42");
 *   console.log(v.major);      // 1
 *   console.log(v.prerelease); // ["alpha", 1]
 *   console.log(v.build);      // ["build", "42"]
 *   console.log(v.toString()); // "1.2.3-alpha.1+build.42"
 * });
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 */
export class SemVer extends SemVerBase<{
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
	readonly prerelease: ReadonlyArray<string | number>;
	readonly build: ReadonlyArray<string>;
}> {
	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof SemVer)) return false;
		return (
			this.major === that.major &&
			this.minor === that.minor &&
			this.patch === that.patch &&
			this.prerelease.length === that.prerelease.length &&
			this.prerelease.every((v, i) => v === that.prerelease[i])
		);
	}

	[Hash.symbol](): number {
		let h = Hash.hash(this.major);
		h = Hash.combine(h)(Hash.hash(this.minor));
		h = Hash.combine(h)(Hash.hash(this.patch));
		for (const item of this.prerelease) {
			h = Hash.combine(h)(Hash.hash(item));
		}
		return Hash.cached(this)(h);
	}

	toString(): string {
		let s = `${this.major}.${this.minor}.${this.patch}`;
		if (this.prerelease.length > 0) {
			s += `-${this.prerelease.join(".")}`;
		}
		if (this.build.length > 0) {
			s += `+${this.build.join(".")}`;
		}
		return s;
	}

	toJSON(): unknown {
		return {
			_tag: "SemVer" as const,
			major: this.major,
			minor: this.minor,
			patch: this.patch,
			prerelease: this.prerelease.slice(),
			build: this.build.slice(),
		};
	}

	[Symbol.for("nodejs.util.inspect.custom")](): string {
		return this.toString();
	}
}
