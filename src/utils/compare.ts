import { Equal, Function as Fn, Option } from "effect";
import { SemVer } from "../schemas/SemVer.js";
import { SemVerOrder, SemVerOrderWithBuild } from "./order.js";

export const compare: {
	(that: SemVer): (self: SemVer) => -1 | 0 | 1;
	(self: SemVer, that: SemVer): -1 | 0 | 1;
} = Fn.dual(2, (self: SemVer, that: SemVer): -1 | 0 | 1 => SemVerOrder(self, that));

export const equal: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => Equal.equals(self, that));

export const gt: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) === 1);

export const gte: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) >= 0);

export const lt: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) === -1);

export const lte: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => SemVerOrder(self, that) <= 0);

export const neq: {
	(that: SemVer): (self: SemVer) => boolean;
	(self: SemVer, that: SemVer): boolean;
} = Fn.dual(2, (self: SemVer, that: SemVer): boolean => !Equal.equals(self, that));

export const isPrerelease = (v: SemVer): boolean => v.prerelease.length > 0;

export const isStable = (v: SemVer): boolean => v.prerelease.length === 0;

export const truncate: {
	(level: "prerelease" | "build"): (v: SemVer) => SemVer;
	(v: SemVer, level: "prerelease" | "build"): SemVer;
} = Fn.dual(
	2,
	(v: SemVer, level: "prerelease" | "build"): SemVer =>
		level === "prerelease"
			? new SemVer(
					{ major: v.major, minor: v.minor, patch: v.patch, prerelease: [], build: [] },
					{ disableValidation: true },
				)
			: new SemVer(
					{
						major: v.major,
						minor: v.minor,
						patch: v.patch,
						prerelease: [...v.prerelease],
						build: [],
					},
					{ disableValidation: true },
				),
);

export const sort = (versions: ReadonlyArray<SemVer>): Array<SemVer> => [...versions].sort(SemVerOrder);

export const rsort = (versions: ReadonlyArray<SemVer>): Array<SemVer> =>
	[...versions].sort((a, b) => SemVerOrder(b, a));

export const max = (versions: ReadonlyArray<SemVer>): Option.Option<SemVer> => {
	if (versions.length === 0) return Option.none();
	let result = versions[0];
	for (let i = 1; i < versions.length; i++) {
		if (SemVerOrder(versions[i], result) === 1) {
			result = versions[i];
		}
	}
	return Option.some(result);
};

export const min = (versions: ReadonlyArray<SemVer>): Option.Option<SemVer> => {
	if (versions.length === 0) return Option.none();
	let result = versions[0];
	for (let i = 1; i < versions.length; i++) {
		if (SemVerOrder(versions[i], result) === -1) {
			result = versions[i];
		}
	}
	return Option.some(result);
};

export const compareWithBuild: {
	(that: SemVer): (self: SemVer) => -1 | 0 | 1;
	(self: SemVer, that: SemVer): -1 | 0 | 1;
} = Fn.dual(2, (self: SemVer, that: SemVer): -1 | 0 | 1 => SemVerOrderWithBuild(self, that));
