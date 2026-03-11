import { Comparator } from "../schemas/Comparator.js";
import { SemVer } from "../schemas/SemVer.js";

export interface Partial {
	readonly major: number | null;
	readonly minor: number | null;
	readonly patch: number | null;
	readonly prerelease: ReadonlyArray<string | number>;
	readonly build: ReadonlyArray<string>;
}

const sv = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
): SemVer =>
	new SemVer({
		major,
		minor,
		patch,
		prerelease: prerelease.slice(),
		build: build.slice(),
	});

const comp = (operator: "=" | ">" | ">=" | "<" | "<=", version: SemVer): Comparator =>
	new Comparator({ operator, version });

export const desugarTilde = (p: Partial): ReadonlyArray<Comparator> => {
	const major = p.major ?? 0;
	const minor = p.minor;
	const patch = p.patch ?? 0;

	if (minor === null) {
		// ~1 -> >=1.0.0 <2.0.0-0
		return [comp(">=", sv(major, 0, 0)), comp("<", sv(major + 1, 0, 0, [0]))];
	}

	// ~1.2.3 -> >=1.2.3 <1.3.0-0
	// ~1.2 -> >=1.2.0 <1.3.0-0
	return [comp(">=", sv(major, minor, patch, p.prerelease)), comp("<", sv(major, minor + 1, 0, [0]))];
};

export const desugarCaret = (p: Partial): ReadonlyArray<Comparator> => {
	const major = p.major ?? 0;
	const minor = p.minor;
	const patch = p.patch;

	const lower = sv(major, minor ?? 0, patch ?? 0, p.prerelease);

	if (major !== 0) {
		// ^1.2.3 -> >=1.2.3 <2.0.0-0
		return [comp(">=", lower), comp("<", sv(major + 1, 0, 0, [0]))];
	}

	// major is 0
	if (minor === null) {
		// ^0.x -> >=0.0.0 <1.0.0-0
		return [comp(">=", lower), comp("<", sv(1, 0, 0, [0]))];
	}

	if (minor !== 0) {
		// ^0.2.3 -> >=0.2.3 <0.3.0-0
		return [comp(">=", lower), comp("<", sv(0, minor + 1, 0, [0]))];
	}

	// major is 0, minor is 0
	if (patch === null) {
		// ^0.0.x or ^0.0 -> >=0.0.0 <0.1.0-0
		return [comp(">=", lower), comp("<", sv(0, 1, 0, [0]))];
	}

	if (patch !== 0) {
		// ^0.0.3 -> >=0.0.3 <0.0.4-0
		return [comp(">=", lower), comp("<", sv(0, 0, patch + 1, [0]))];
	}

	// ^0.0.0 -> >=0.0.0 <0.0.1-0
	return [comp(">=", lower), comp("<", sv(0, 0, 1, [0]))];
};

export const desugarXRange = (operator: string | null, p: Partial): ReadonlyArray<Comparator> => {
	const major = p.major;
	const minor = p.minor;
	const patch = p.patch;

	// Fully specified (no wildcards)
	if (major !== null && minor !== null && patch !== null) {
		const version = sv(major, minor, patch, p.prerelease, p.build);
		if (operator === null || operator === "=") {
			return [comp("=", version)];
		}
		return [comp(operator as ">" | ">=" | "<" | "<=", version)];
	}

	// Has wildcards
	if (major === null) {
		// * -> >=0.0.0
		if (operator === null || operator === "" || operator === "=") {
			return [comp(">=", sv(0, 0, 0))];
		}
		// >* or >=* etc. — still match all or nothing, but >=0.0.0 covers it
		return [comp(">=", sv(0, 0, 0))];
	}

	if (minor === null) {
		// 1.x or 1.*
		if (operator === null || operator === "" || operator === "=") {
			return [comp(">=", sv(major, 0, 0)), comp("<", sv(major + 1, 0, 0, [0]))];
		}
		if (operator === ">") {
			// >1.x -> >=2.0.0
			return [comp(">=", sv(major + 1, 0, 0))];
		}
		if (operator === ">=") {
			// >=1.x -> >=1.0.0
			return [comp(">=", sv(major, 0, 0))];
		}
		if (operator === "<") {
			// <1.x -> <1.0.0
			return [comp("<", sv(major, 0, 0))];
		}
		if (operator === "<=") {
			// <=1.x -> <2.0.0-0
			return [comp("<", sv(major + 1, 0, 0, [0]))];
		}
	}

	// patch is null (minor is set): 1.2.x
	if (operator === null || operator === "" || operator === "=") {
		return [comp(">=", sv(major, minor as number, 0)), comp("<", sv(major, (minor as number) + 1, 0, [0]))];
	}
	if (operator === ">") {
		// >1.2.x -> >=1.3.0
		return [comp(">=", sv(major, (minor as number) + 1, 0))];
	}
	if (operator === ">=") {
		// >=1.2.x -> >=1.2.0
		return [comp(">=", sv(major, minor as number, 0))];
	}
	if (operator === "<") {
		// <1.2.x -> <1.2.0
		return [comp("<", sv(major, minor as number, 0))];
	}
	// <=1.2.x -> <1.3.0-0
	return [comp("<", sv(major, (minor as number) + 1, 0, [0]))];
};

export const desugarHyphen = (lower: Partial, upper: Partial): ReadonlyArray<Comparator> => {
	const lowerVersion = sv(lower.major ?? 0, lower.minor ?? 0, lower.patch ?? 0, lower.prerelease);

	if (upper.major !== null && upper.minor !== null && upper.patch !== null) {
		// Full upper: >=lower <=upper
		const upperVersion = sv(upper.major, upper.minor, upper.patch, upper.prerelease);
		return [comp(">=", lowerVersion), comp("<=", upperVersion)];
	}

	// Partial upper
	if (upper.major !== null && upper.minor !== null) {
		// 1.2.3 - 2.3 -> >=1.2.3 <2.4.0-0
		return [comp(">=", lowerVersion), comp("<", sv(upper.major, upper.minor + 1, 0, [0]))];
	}

	if (upper.major !== null) {
		// 1.2.3 - 2 -> >=1.2.3 <3.0.0-0
		return [comp(">=", lowerVersion), comp("<", sv(upper.major + 1, 0, 0, [0]))];
	}

	// upper is * -> >=lower
	return [comp(">=", lowerVersion)];
};
