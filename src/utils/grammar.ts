import { Effect } from "effect";
import { InvalidComparatorError } from "../errors/InvalidComparatorError.js";
import { InvalidRangeError } from "../errors/InvalidRangeError.js";
import { InvalidVersionError } from "../errors/InvalidVersionError.js";
import { Comparator } from "../schemas/Comparator.js";
import { Range } from "../schemas/Range.js";
import { SemVer } from "../schemas/SemVer.js";
import type { Partial } from "./desugar.js";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange } from "./desugar.js";

interface ParserState {
	readonly input: string;
	pos: number;
	readonly len: number;
}

const peek = (s: ParserState): string | undefined => (s.pos < s.len ? s.input[s.pos] : undefined);

const advance = (s: ParserState): string | undefined => {
	if (s.pos < s.len) {
		const ch = s.input[s.pos];
		s.pos++;
		return ch;
	}
	return undefined;
};

const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";

const isLetter = (ch: string): boolean => (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");

const isIdentChar = (ch: string): boolean => isDigit(ch) || isLetter(ch) || ch === "-";

const atEnd = (s: ParserState): boolean => s.pos >= s.len;

const peekDigit = (s: ParserState): boolean => {
	const ch = peek(s);
	return ch !== undefined && isDigit(ch);
};

const peekIdentChar = (s: ParserState): boolean => {
	const ch = peek(s);
	return ch !== undefined && isIdentChar(ch);
};

const fail = (s: ParserState): InvalidVersionError => new InvalidVersionError({ input: s.input, position: s.pos });

const parseNumericIdentifier = (s: ParserState): Effect.Effect<number, InvalidVersionError> =>
	Effect.gen(function* () {
		const start = s.pos;
		const first = peek(s);
		if (first === undefined || !isDigit(first)) {
			return yield* Effect.fail(fail(s));
		}

		let digits = "";
		while (peekDigit(s)) {
			digits += advance(s);
		}

		// Reject leading zeros (except "0" itself)
		if (digits.length > 1 && digits[0] === "0") {
			s.pos = start;
			return yield* Effect.fail(new InvalidVersionError({ input: s.input, position: start }));
		}

		const value = Number(digits);
		if (!Number.isSafeInteger(value)) {
			s.pos = start;
			return yield* Effect.fail(new InvalidVersionError({ input: s.input, position: start }));
		}

		return value;
	});

const parsePrereleaseIdentifier = (s: ParserState): Effect.Effect<string | number, InvalidVersionError> =>
	Effect.gen(function* () {
		const start = s.pos;
		let token = "";
		let hasNonDigit = false;

		const first = peek(s);
		if (first === undefined || !isIdentChar(first)) {
			return yield* Effect.fail(fail(s));
		}

		while (peekIdentChar(s)) {
			const ch = advance(s) ?? "";
			if (!isDigit(ch)) {
				hasNonDigit = true;
			}
			token += ch;
		}

		if (token.length === 0) {
			return yield* Effect.fail(fail(s));
		}

		if (hasNonDigit) {
			// Alphanumeric identifier — no leading zero restriction
			return token;
		}

		// All digits — numeric identifier, check leading zeros
		if (token.length > 1 && token[0] === "0") {
			s.pos = start;
			return yield* Effect.fail(new InvalidVersionError({ input: s.input, position: start }));
		}

		const value = Number(token);
		if (!Number.isSafeInteger(value)) {
			s.pos = start;
			return yield* Effect.fail(new InvalidVersionError({ input: s.input, position: start }));
		}

		return value;
	});

const parseBuildIdentifier = (s: ParserState): Effect.Effect<string, InvalidVersionError> =>
	Effect.gen(function* () {
		let token = "";

		const first = peek(s);
		if (first === undefined || !isIdentChar(first)) {
			return yield* Effect.fail(fail(s));
		}

		while (peekIdentChar(s)) {
			token += advance(s);
		}

		if (token.length === 0) {
			return yield* Effect.fail(fail(s));
		}

		// Build identifiers allow leading zeros — just return as string
		return token;
	});

const parsePreRelease = (s: ParserState): Effect.Effect<Array<string | number>, InvalidVersionError> =>
	Effect.gen(function* () {
		const identifiers: Array<string | number> = [];

		identifiers.push(yield* parsePrereleaseIdentifier(s));

		while (!atEnd(s) && peek(s) === ".") {
			advance(s); // consume '.'
			identifiers.push(yield* parsePrereleaseIdentifier(s));
		}

		return identifiers;
	});

const parseBuild = (s: ParserState): Effect.Effect<Array<string>, InvalidVersionError> =>
	Effect.gen(function* () {
		const identifiers: Array<string> = [];

		identifiers.push(yield* parseBuildIdentifier(s));

		while (!atEnd(s) && peek(s) === ".") {
			advance(s); // consume '.'
			identifiers.push(yield* parseBuildIdentifier(s));
		}

		return identifiers;
	});

/**
 * Parse a string into a {@link SemVer} using a strict SemVer 2.0.0
 * recursive-descent parser.
 *
 * Rejects `v`/`V` prefixes, `=` prefixes, leading zeros on numeric identifiers,
 * and any input that does not fully consume as a valid `major.minor.patch[-prerelease][+build]`
 * string. Returns an {@link Effect.Effect} that fails with {@link InvalidVersionError}
 * on invalid input.
 *
 * This function is re-exported from the barrel as `parseVersion`.
 *
 * @example
 * ```typescript
 * import type { SemVer } from "semver-effect";
 * import { parseVersion } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const v: SemVer = yield* parseVersion("1.2.3-beta.1+build.42");
 *   console.log(v.toString()); // "1.2.3-beta.1+build.42"
 * });
 * ```
 *
 * @see {@link SemVer}
 * @see {@link InvalidVersionError}
 * @see {@link https://semver.org | SemVer 2.0.0 Specification}
 */
export const parseValidSemVer = (raw: string): Effect.Effect<SemVer, InvalidVersionError> =>
	Effect.gen(function* () {
		const trimmed = raw.trim();
		const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };

		if (s.len === 0) {
			return yield* Effect.fail(new InvalidVersionError({ input: raw, position: 0 }));
		}

		// Reject v/V prefix
		const first = peek(s);
		if (first === "v" || first === "V") {
			return yield* Effect.fail(new InvalidVersionError({ input: trimmed, position: 0 }));
		}

		// Reject = prefix
		if (first === "=") {
			return yield* Effect.fail(new InvalidVersionError({ input: trimmed, position: 0 }));
		}

		// Parse major.minor.patch
		const major = yield* parseNumericIdentifier(s);

		if (peek(s) !== ".") {
			return yield* Effect.fail(fail(s));
		}
		advance(s); // consume '.'

		const minor = yield* parseNumericIdentifier(s);

		if (peek(s) !== ".") {
			return yield* Effect.fail(fail(s));
		}
		advance(s); // consume '.'

		const patch = yield* parseNumericIdentifier(s);

		// Optional prerelease
		let prerelease: Array<string | number> = [];
		if (!atEnd(s) && peek(s) === "-") {
			advance(s); // consume '-'
			prerelease = yield* parsePreRelease(s);
		}

		// Optional build
		let build: Array<string> = [];
		if (!atEnd(s) && peek(s) === "+") {
			advance(s); // consume '+'
			build = yield* parseBuild(s);
		}

		// Verify entire input consumed
		if (!atEnd(s)) {
			return yield* Effect.fail(fail(s));
		}

		return new SemVer({
			major,
			minor,
			patch,
			prerelease,
			build,
		});
	});

// ---------------------------------------------------------------------------
// Range parsing helpers (reuse existing low-level helpers with InvalidRangeError)
// ---------------------------------------------------------------------------

const failRange = (s: ParserState): InvalidRangeError => new InvalidRangeError({ input: s.input, position: s.pos });

const parseNumericIdentifierRange = (s: ParserState): Effect.Effect<number, InvalidRangeError> =>
	Effect.gen(function* () {
		const start = s.pos;
		const first = peek(s);
		if (first === undefined || !isDigit(first)) {
			return yield* Effect.fail(failRange(s));
		}

		let digits = "";
		while (peekDigit(s)) {
			digits += advance(s);
		}

		if (digits.length > 1 && digits[0] === "0") {
			s.pos = start;
			return yield* Effect.fail(new InvalidRangeError({ input: s.input, position: start }));
		}

		const value = Number(digits);
		if (!Number.isSafeInteger(value)) {
			s.pos = start;
			return yield* Effect.fail(new InvalidRangeError({ input: s.input, position: start }));
		}

		return value;
	});

const parsePrereleaseIdentifierRange = (s: ParserState): Effect.Effect<string | number, InvalidRangeError> =>
	Effect.gen(function* () {
		const start = s.pos;
		let token = "";
		let hasNonDigit = false;

		const first = peek(s);
		if (first === undefined || !isIdentChar(first)) {
			return yield* Effect.fail(failRange(s));
		}

		while (peekIdentChar(s)) {
			const ch = advance(s) ?? "";
			if (!isDigit(ch)) {
				hasNonDigit = true;
			}
			token += ch;
		}

		if (token.length === 0) {
			return yield* Effect.fail(failRange(s));
		}

		if (hasNonDigit) {
			return token;
		}

		if (token.length > 1 && token[0] === "0") {
			s.pos = start;
			return yield* Effect.fail(new InvalidRangeError({ input: s.input, position: start }));
		}

		const value = Number(token);
		if (!Number.isSafeInteger(value)) {
			s.pos = start;
			return yield* Effect.fail(new InvalidRangeError({ input: s.input, position: start }));
		}

		return value;
	});

const parseBuildIdentifierRange = (s: ParserState): Effect.Effect<string, InvalidRangeError> =>
	Effect.gen(function* () {
		let token = "";

		const first = peek(s);
		if (first === undefined || !isIdentChar(first)) {
			return yield* Effect.fail(failRange(s));
		}

		while (peekIdentChar(s)) {
			token += advance(s);
		}

		if (token.length === 0) {
			return yield* Effect.fail(failRange(s));
		}

		return token;
	});

const parsePrereleaseRange = (s: ParserState): Effect.Effect<Array<string | number>, InvalidRangeError> =>
	Effect.gen(function* () {
		const identifiers: Array<string | number> = [];

		identifiers.push(yield* parsePrereleaseIdentifierRange(s));

		while (!atEnd(s) && peek(s) === ".") {
			advance(s);
			identifiers.push(yield* parsePrereleaseIdentifierRange(s));
		}

		return identifiers;
	});

const parseBuildRange = (s: ParserState): Effect.Effect<Array<string>, InvalidRangeError> =>
	Effect.gen(function* () {
		const identifiers: Array<string> = [];

		identifiers.push(yield* parseBuildIdentifierRange(s));

		while (!atEnd(s) && peek(s) === ".") {
			advance(s);
			identifiers.push(yield* parseBuildIdentifierRange(s));
		}

		return identifiers;
	});

const parseXR = (s: ParserState): Effect.Effect<number | null, InvalidRangeError> =>
	Effect.gen(function* () {
		const ch = peek(s);
		if (ch === "x" || ch === "X" || ch === "*") {
			advance(s);
			return null;
		}
		return yield* parseNumericIdentifierRange(s);
	});

const parsePartial = (s: ParserState): Effect.Effect<Partial, InvalidRangeError> =>
	Effect.gen(function* () {
		const major = yield* parseXR(s);

		let minor: number | null = null;
		let patch: number | null = null;
		let prerelease: Array<string | number> = [];
		let build: Array<string> = [];

		if (!atEnd(s) && peek(s) === ".") {
			advance(s);
			minor = yield* parseXR(s);

			if (!atEnd(s) && peek(s) === ".") {
				advance(s);
				patch = yield* parseXR(s);

				// Optional prerelease (only if patch is numeric, not wildcard)
				if (patch !== null && !atEnd(s) && peek(s) === "-") {
					advance(s);
					prerelease = yield* parsePrereleaseRange(s);
				}

				// Optional build
				if (patch !== null && !atEnd(s) && peek(s) === "+") {
					advance(s);
					build = yield* parseBuildRange(s);
				}
			}
		}

		return { major, minor, patch, prerelease, build };
	});

const parseOperator = (s: ParserState): string | null => {
	const ch = peek(s);
	if (ch === ">") {
		advance(s);
		if (peek(s) === "=") {
			advance(s);
			return ">=";
		}
		return ">";
	}
	if (ch === "<") {
		advance(s);
		if (peek(s) === "=") {
			advance(s);
			return "<=";
		}
		return "<";
	}
	if (ch === "=") {
		advance(s);
		return "=";
	}
	return null;
};

const skipSpaces = (s: ParserState): void => {
	while (!atEnd(s) && peek(s) === " ") {
		advance(s);
	}
};

const isHyphenRange = (s: ParserState): boolean =>
	s.pos + 2 < s.len && s.input[s.pos] === " " && s.input[s.pos + 1] === "-" && s.input[s.pos + 2] === " ";

const isOrSeparator = (s: ParserState): boolean => {
	// Skip optional leading spaces, then check for ||
	let pos = s.pos;
	while (pos < s.len && s.input[pos] === " ") {
		pos++;
	}
	return pos + 1 < s.len && s.input[pos] === "|" && s.input[pos + 1] === "|";
};

const consumeOrSeparator = (s: ParserState): void => {
	while (!atEnd(s) && peek(s) === " ") {
		advance(s);
	}
	advance(s); // first |
	advance(s); // second |
	while (!atEnd(s) && peek(s) === " ") {
		advance(s);
	}
};

const parseSimple = (s: ParserState): Effect.Effect<ReadonlyArray<Comparator>, InvalidRangeError> =>
	Effect.gen(function* () {
		const ch = peek(s);

		if (ch === "~") {
			advance(s);
			// Reject ~> (Ruby-style)
			if (peek(s) === ">") {
				return yield* Effect.fail(failRange(s));
			}
			const partial = yield* parsePartial(s);
			return desugarTilde(partial);
		}

		if (ch === "^") {
			advance(s);
			const partial = yield* parsePartial(s);
			return desugarCaret(partial);
		}

		// Primitive: optional operator + partial
		const operator = parseOperator(s);
		const partial = yield* parsePartial(s);
		return desugarXRange(operator, partial);
	});

const atRangeEnd = (s: ParserState): boolean => {
	if (atEnd(s)) return true;
	// Check if we're at || separator
	const saved = s.pos;
	let pos = saved;
	while (pos < s.len && s.input[pos] === " ") {
		pos++;
	}
	if (pos + 1 < s.len && s.input[pos] === "|" && s.input[pos + 1] === "|") {
		return true;
	}
	return false;
};

const parseRangeComparators = (s: ParserState): Effect.Effect<ReadonlyArray<Comparator>, InvalidRangeError> =>
	Effect.gen(function* () {
		skipSpaces(s);

		// Try hyphen range first
		const savedPos = s.pos;
		const tryHyphen = yield* Effect.either(
			Effect.gen(function* () {
				const lower = yield* parsePartial(s);
				if (!isHyphenRange(s)) {
					return yield* Effect.fail(failRange(s));
				}
				advance(s); // space
				advance(s); // -
				advance(s); // space
				const upper = yield* parsePartial(s);
				return desugarHyphen(lower, upper);
			}),
		);

		if (tryHyphen._tag === "Right") {
			return tryHyphen.right;
		}

		// Not a hyphen range — reset and parse space-separated simples
		s.pos = savedPos;
		const comparators: Array<Comparator> = [];

		const first = yield* parseSimple(s);
		for (const c of first) {
			comparators.push(c);
		}

		while (!atRangeEnd(s)) {
			// Expect at least one space between simples
			if (peek(s) !== " ") {
				break;
			}
			skipSpaces(s);
			if (atRangeEnd(s)) break;

			const next = yield* parseSimple(s);
			for (const c of next) {
				comparators.push(c);
			}
		}

		return comparators;
	});

export const parseRangeSet = (raw: string): Effect.Effect<Range, InvalidRangeError> =>
	Effect.gen(function* () {
		const trimmed = raw.trim();

		if (trimmed.length === 0) {
			// Empty string = match all
			return new Range({
				sets: [desugarXRange(null, { major: null, minor: null, patch: null, prerelease: [], build: [] })],
			});
		}

		const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };
		const sets: Array<ReadonlyArray<Comparator>> = [];

		const first = yield* parseRangeComparators(s);
		sets.push(first);

		while (!atEnd(s)) {
			if (isOrSeparator(s)) {
				consumeOrSeparator(s);
				const next = yield* parseRangeComparators(s);
				sets.push(next);
			} else {
				break;
			}
		}

		if (!atEnd(s)) {
			return yield* Effect.fail(failRange(s));
		}

		return new Range({ sets });
	});

/**
 * Parse a string into a single {@link Comparator}.
 *
 * Accepts an optional operator prefix (`=`, `>`, `>=`, `<`, `<=`) followed by
 * a complete `major.minor.patch[-prerelease][+build]` version string. Wildcards
 * and range syntax (tilde, caret, hyphen, X-range) are not allowed.
 *
 * If no operator is specified, `"="` (exact match) is assumed.
 *
 * This function is re-exported from the barrel as `parseComparator`.
 *
 * @example
 * ```typescript
 * import { parseComparator } from "semver-effect";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const comp = yield* parseComparator(">=1.0.0");
 *   console.log(comp.operator); // ">="
 *   console.log(comp.version.toString()); // "1.0.0"
 * });
 * ```
 *
 * @see {@link Comparator}
 * @see {@link InvalidComparatorError}
 */
export const parseSingleComparator = (raw: string): Effect.Effect<Comparator, InvalidComparatorError> =>
	Effect.gen(function* () {
		const trimmed = raw.trim();

		if (trimmed.length === 0) {
			return yield* Effect.fail(new InvalidComparatorError({ input: raw, position: 0 }));
		}

		const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };

		const operator = parseOperator(s);

		// Reject things like >> or <>
		const ch = peek(s);
		if (ch === ">" || ch === "<" || ch === "=") {
			return yield* Effect.fail(new InvalidComparatorError({ input: trimmed, position: s.pos }));
		}

		// Parse full version (major.minor.patch required, no wildcards)
		const major = yield* parseNumericIdentifierRange(s).pipe(
			Effect.mapError(() => new InvalidComparatorError({ input: trimmed, position: s.pos })),
		);

		if (peek(s) !== ".") {
			return yield* Effect.fail(new InvalidComparatorError({ input: trimmed, position: s.pos }));
		}
		advance(s);

		const minor = yield* parseNumericIdentifierRange(s).pipe(
			Effect.mapError(() => new InvalidComparatorError({ input: trimmed, position: s.pos })),
		);

		if (peek(s) !== ".") {
			return yield* Effect.fail(new InvalidComparatorError({ input: trimmed, position: s.pos }));
		}
		advance(s);

		const patch = yield* parseNumericIdentifierRange(s).pipe(
			Effect.mapError(() => new InvalidComparatorError({ input: trimmed, position: s.pos })),
		);

		let prerelease: Array<string | number> = [];
		if (!atEnd(s) && peek(s) === "-") {
			advance(s);
			prerelease = yield* parsePrereleaseRange(s).pipe(
				Effect.mapError(() => new InvalidComparatorError({ input: trimmed, position: s.pos })),
			);
		}

		let build: Array<string> = [];
		if (!atEnd(s) && peek(s) === "+") {
			advance(s);
			build = yield* parseBuildRange(s).pipe(
				Effect.mapError(() => new InvalidComparatorError({ input: trimmed, position: s.pos })),
			);
		}

		if (!atEnd(s)) {
			return yield* Effect.fail(new InvalidComparatorError({ input: trimmed, position: s.pos }));
		}

		const version = new SemVer({ major, minor, patch, prerelease, build });

		return new Comparator({ operator: (operator ?? "=") as "=" | ">" | ">=" | "<" | "<=", version });
	});
