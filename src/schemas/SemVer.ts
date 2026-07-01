import { Equal, Hash, Schema } from "effect";
import type { InvalidVersionError } from "../errors/InvalidVersionError.js";
import type { VersionDiff } from "./VersionDiff.js";

// ── Prerelease comparison (inlined to avoid circular dep with order.ts) ─

const comparePre = (a: string | number, b: string | number): number => {
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
	if (typeof a === "number") return -1;
	return 1;
};

/**
 * A parsed SemVer 2.0.0 version, represented as an Effect `Schema.TaggedClass`.
 *
 * Provides instance methods for comparison, bumping, and predicates, plus
 * static methods for parsing and collection operations.
 *
 * @example
 * ```typescript
 * import { SemVer } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v = yield* SemVer.parse("1.2.3");
 *   const next = v.bump.minor();          // 1.3.0
 *   console.log(v.gt(next));              // false
 *   console.log(next.isStable);           // true
 * });
 * ```
 *
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 * @public
 */
export class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
	major: Schema.Number,
	minor: Schema.Number,
	patch: Schema.Number,
	prerelease: Schema.Array(Schema.Union(Schema.String, Schema.Number)),
	build: Schema.Array(Schema.String),
}) {
	// ── Cross-cutting statics (wired in index.ts) ───────────────────────
	// These are assigned by index.ts at module load time to avoid circular
	// imports. Always import from "semver-effect", not from this file directly.

	/** Parse a strict SemVer 2.0.0 string. @remarks Import from `"semver-effect"`, not the schema subpath. */
	static parse: (input: string) => import("effect/Effect").Effect<SemVer, InvalidVersionError>;

	/** Convenience positional constructor. Wired at module load by index.ts. */
	static of: (
		major: number,
		minor: number,
		patch: number,
		prerelease?: ReadonlyArray<string | number>,
		build?: ReadonlyArray<string>,
	) => SemVer;

	/** Compare two versions. Returns `-1`, `0`, or `1`. Dual API. */
	static compare: {
		(that: SemVer): (self: SemVer) => -1 | 0 | 1;
		(self: SemVer, that: SemVer): -1 | 0 | 1;
	};

	/** Test whether `self > that`. Dual API. */
	static gt: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	};

	/** Test whether `self >= that`. Dual API. */
	static gte: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	};

	/** Test whether `self < that`. Dual API. */
	static lt: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	};

	/** Test whether `self <= that`. Dual API. */
	static lte: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	};

	/** Test whether `self !== that`. Dual API. */
	static neq: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	};

	/** Test whether two versions are equal (ignores build). Dual API. */
	static equal: {
		(that: SemVer): (self: SemVer) => boolean;
		(self: SemVer, that: SemVer): boolean;
	};

	/** Compute diff between two versions. Dual API. */
	static diff: {
		(that: SemVer): (self: SemVer) => VersionDiff;
		(self: SemVer, that: SemVer): VersionDiff;
	};

	/** Sort versions ascending. */
	static sort: (versions: ReadonlyArray<SemVer>) => Array<SemVer>;

	/** Sort versions descending. */
	static rsort: (versions: ReadonlyArray<SemVer>) => Array<SemVer>;

	/** Highest version, or `Option.none()` if empty. */
	static max: (versions: ReadonlyArray<SemVer>) => import("effect/Option").Option<SemVer>;

	/** Lowest version, or `Option.none()` if empty. */
	static min: (versions: ReadonlyArray<SemVer>) => import("effect/Option").Option<SemVer>;

	// ── Instance: comparison ────────────────────────────────────────────

	/** Compare `this` to `that` per SemVer 2.0.0 precedence. Returns `-1`, `0`, or `1`. */
	compare(that: SemVer): -1 | 0 | 1 {
		if (this.major !== that.major) return this.major > that.major ? 1 : -1;
		if (this.minor !== that.minor) return this.minor > that.minor ? 1 : -1;
		if (this.patch !== that.patch) return this.patch > that.patch ? 1 : -1;

		const aPre = this.prerelease;
		const bPre = that.prerelease;
		if (aPre.length === 0 && bPre.length === 0) return 0;
		if (aPre.length === 0) return 1;
		if (bPre.length === 0) return -1;

		const len = Math.min(aPre.length, bPre.length);
		for (let i = 0; i < len; i++) {
			const cmp = comparePre(aPre[i], bPre[i]);
			if (cmp !== 0) return cmp < 0 ? -1 : 1;
		}

		if (aPre.length !== bPre.length) return aPre.length > bPre.length ? 1 : -1;
		return 0;
	}

	/** Test whether `this > that`. */
	gt(that: SemVer): boolean {
		return this.compare(that) === 1;
	}

	/** Test whether `this >= that`. */
	gte(that: SemVer): boolean {
		return this.compare(that) >= 0;
	}

	/** Test whether `this < that`. */
	lt(that: SemVer): boolean {
		return this.compare(that) === -1;
	}

	/** Test whether `this <= that`. */
	lte(that: SemVer): boolean {
		return this.compare(that) <= 0;
	}

	/** Test whether `this` equals `that` (ignores build metadata). */
	equal(that: SemVer): boolean {
		return this.compare(that) === 0;
	}

	/** Alias for {@link equal}. */
	eq(that: SemVer): boolean {
		return this.equal(that);
	}

	/** Test whether `this` does not equal `that` (ignores build metadata). */
	neq(that: SemVer): boolean {
		return this.compare(that) !== 0;
	}

	// ── Instance: predicates ────────────────────────────────────────────

	/** Whether this is a prerelease version. */
	get isPrerelease(): boolean {
		return this.prerelease.length > 0;
	}

	/** Whether this is a stable (non-prerelease) version. */
	get isStable(): boolean {
		return this.prerelease.length === 0;
	}

	// ── Instance: bump ──────────────────────────────────────────────────

	private _bump: SemVerBump | undefined;

	/** Version bumping operations. */
	get bump(): SemVerBump {
		if (!this._bump) {
			this._bump = new SemVerBump(this);
		}
		return this._bump;
	}

	// ── Equality & hashing ──────────────────────────────────────────────

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

	// ── Display ─────────────────────────────────────────────────────────

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

// ── Bump helper ─────────────────────────────────────────────────────────

/**
 * Grouped bump operations returned by {@link SemVer.bump}.
 *
 * @public
 */
export class SemVerBump {
	constructor(private readonly v: SemVer) {}

	/** Bump major (resets minor, patch, prerelease, build). */
	major(): SemVer {
		return new SemVer({ major: this.v.major + 1, minor: 0, patch: 0, prerelease: [], build: [] });
	}

	/** Bump minor (resets patch, prerelease, build). */
	minor(): SemVer {
		return new SemVer({ major: this.v.major, minor: this.v.minor + 1, patch: 0, prerelease: [], build: [] });
	}

	/** Bump patch (resets prerelease, build). */
	patch(): SemVer {
		return new SemVer({
			major: this.v.major,
			minor: this.v.minor,
			patch: this.v.patch + 1,
			prerelease: [],
			build: [],
		});
	}

	/** Bump prerelease, optionally with a named identifier. */
	prerelease(id?: string): SemVer {
		const { major, minor, patch } = this.v;
		const pre = this.v.prerelease;

		if (pre.length === 0) {
			return new SemVer({
				major,
				minor,
				patch: patch + 1,
				prerelease: id !== undefined ? [id, 0] : [0],
				build: [],
			});
		}

		if (id !== undefined) {
			const currentPrefix = typeof pre[0] === "string" ? pre[0] : null;
			if (currentPrefix !== id) {
				return new SemVer({ major, minor, patch, prerelease: [id, 0], build: [] });
			}
		}

		const last = pre[pre.length - 1];
		if (typeof last === "number") {
			const newPre: Array<string | number> = [...pre];
			newPre[newPre.length - 1] = last + 1;
			return new SemVer({ major, minor, patch, prerelease: newPre, build: [] });
		}

		return new SemVer({ major, minor, patch, prerelease: [...pre, 0], build: [] });
	}

	/** Strip prerelease and build, keeping major.minor.patch. */
	release(): SemVer {
		return new SemVer({
			major: this.v.major,
			minor: this.v.minor,
			patch: this.v.patch,
			prerelease: [],
			build: [],
		});
	}
}
