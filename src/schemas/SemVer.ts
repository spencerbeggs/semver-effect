import { Equal, Hash, Schema } from "effect";

const NonNegativeInt = Schema.Int.pipe(Schema.filter((n) => n >= 0));

const PrereleaseItem = Schema.Union(Schema.String, NonNegativeInt);

export class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
	major: NonNegativeInt,
	minor: NonNegativeInt,
	patch: NonNegativeInt,
	prerelease: Schema.Array(PrereleaseItem),
	build: Schema.Array(Schema.String),
}) {
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
