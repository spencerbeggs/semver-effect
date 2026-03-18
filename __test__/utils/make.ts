import { SemVer } from "../../src/schemas/SemVer.js";

export const make = (
	major: number,
	minor: number,
	patch: number,
	prerelease: ReadonlyArray<string | number> = [],
	build: ReadonlyArray<string> = [],
): SemVer => new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [...build] });
