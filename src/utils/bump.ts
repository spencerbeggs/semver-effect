import { SemVer } from "../schemas/SemVer.js";

const sv = (major: number, minor: number, patch: number, prerelease: ReadonlyArray<string | number> = []): SemVer =>
	new SemVer({ major, minor, patch, prerelease: [...prerelease], build: [] }, { disableValidation: true });

export const bumpMajor = (v: SemVer): SemVer => sv(v.major + 1, 0, 0);

export const bumpMinor = (v: SemVer): SemVer => sv(v.major, v.minor + 1, 0);

export const bumpPatch = (v: SemVer): SemVer => sv(v.major, v.minor, v.patch + 1);

export const bumpPrerelease = (v: SemVer, id?: string): SemVer => {
	const pre = v.prerelease;

	if (pre.length === 0) {
		// No prerelease: bump patch and add prerelease
		return id !== undefined ? sv(v.major, v.minor, v.patch + 1, [id, 0]) : sv(v.major, v.minor, v.patch + 1, [0]);
	}

	// Has prerelease
	if (id !== undefined) {
		// Check if current prefix matches
		const currentPrefix = typeof pre[0] === "string" ? pre[0] : null;
		if (currentPrefix !== id) {
			// Different prefix: reset
			return sv(v.major, v.minor, v.patch, [id, 0]);
		}
	}

	// Increment last numeric, or append 0
	const last = pre[pre.length - 1];
	if (typeof last === "number") {
		const newPre = [...pre];
		newPre[newPre.length - 1] = last + 1;
		return sv(v.major, v.minor, v.patch, newPre);
	}

	// Last is string: append 0
	return sv(v.major, v.minor, v.patch, [...pre, 0]);
};

export const bumpRelease = (v: SemVer): SemVer => sv(v.major, v.minor, v.patch);
