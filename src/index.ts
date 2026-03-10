/**
 * semver-effect
 *
 * Strict SemVer 2.0.0 implementation built on Effect, providing typed
 * parsing, range algebra, and version cache services.
 *
 * @packageDocumentation
 */

export { EmptyCacheError } from "./errors/EmptyCacheError.js";
export { InvalidBumpError } from "./errors/InvalidBumpError.js";
export { InvalidComparatorError } from "./errors/InvalidComparatorError.js";
export { InvalidPrereleaseError } from "./errors/InvalidPrereleaseError.js";
export { InvalidRangeError } from "./errors/InvalidRangeError.js";
// Errors -- Parsing
export { InvalidVersionError } from "./errors/InvalidVersionError.js";
// Errors -- Constraint
export { UnsatisfiableConstraintError } from "./errors/UnsatisfiableConstraintError.js";
// Errors -- Resolution
export { UnsatisfiedRangeError } from "./errors/UnsatisfiedRangeError.js";
// Errors -- Fetch
export { VersionFetchError } from "./errors/VersionFetchError.js";
export { VersionNotFoundError } from "./errors/VersionNotFoundError.js";
