# Phase 1: Project Scaffolding & Error Model

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents available) or superpowers:executing-plans to implement this plan.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template placeholder code with the semver-effect directory
structure and implement all 10 error classes using the split base pattern.

**Architecture:** Flat error hierarchy extending `Data.TaggedError`. Each error
lives in its own file under `src/errors/`. No barrel files except
`src/index.ts`. Tests live in `__test__/` adjacent to `src/`.

**Tech Stack:** Effect (peer dep), TypeScript, Vitest, Biome

**GitHub Issues:** #10 (scaffolding), #11 (error model)

---

## File Structure

### Files to create

```text
src/errors/InvalidVersionError.ts
src/errors/InvalidRangeError.ts
src/errors/InvalidComparatorError.ts
src/errors/InvalidPrereleaseError.ts
src/errors/UnsatisfiedRangeError.ts
src/errors/VersionNotFoundError.ts
src/errors/EmptyCacheError.ts
src/errors/UnsatisfiableConstraintError.ts
src/errors/InvalidBumpError.ts
src/errors/VersionFetchError.ts
__test__/errors.test.ts
```

### Files to modify

```text
src/index.ts          -- replace placeholder with error re-exports
src/index.test.ts     -- delete (placeholder test)
package.json          -- add effect as peer dependency
```

### Files to delete

```text
src/index.test.ts     -- template placeholder test
```

---

## Chunk 1: Scaffolding

### Task 1: Add Effect peer dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install effect as a peer dependency**

```bash
pnpm add effect --save-peer
```

This adds `effect` to `peerDependencies` in package.json. Since
`autoInstallPeers: true` is set in pnpm config, it will also be available
for development.

- [ ] **Step 2: Verify effect is available**

```bash
pnpm exec node -e "import('effect').then(e => console.log('Effect version:', e.Effect ? 'OK' : 'FAIL'))"
```

Expected: `Effect version: OK`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add effect as peer dependency

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

### Task 2: Create directory structure and clear placeholder

**Files:**
- Modify: `src/index.ts` -- clear placeholder content
- Delete: `src/index.test.ts` -- remove placeholder test
- Create directories: `src/errors/`, `src/schemas/`, `src/services/`,
  `src/layers/`, `src/utils/`

- [ ] **Step 1: Create source directories**

```bash
mkdir -p src/errors src/schemas src/services src/layers src/utils
```

- [ ] **Step 2: Remove placeholder test file**

Delete `src/index.test.ts` entirely. It tests the template's `Bar`/`Foo`
placeholder which we are removing.

- [ ] **Step 3: Replace src/index.ts with module docblock**

Replace the entire contents of `src/index.ts` with:

```typescript
/**
 * semver-effect
 *
 * Strict SemVer 2.0.0 implementation built on Effect, providing typed
 * parsing, range algebra, and version cache services.
 *
 * @packageDocumentation
 */
```

This file will accumulate re-exports as modules are implemented. For now
it is empty to ensure the build and typecheck still pass.

- [ ] **Step 4: Verify build and typecheck pass**

```bash
pnpm run typecheck
```

Expected: clean pass (no errors).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold directory structure for semver-effect

Remove template placeholder code. Create src/{errors,schemas,services,
layers,utils} directories. Clear index.ts for real exports.

Closes #10

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 2: Error Model -- Parsing Errors

### Task 3: Write failing tests for parsing errors

**Files:**
- Create: `__test__/errors.test.ts`

- [ ] **Step 1: Write test file for parsing error classes**

Create `__test__/errors.test.ts` with tests for all 4 parsing errors.
Each test verifies: construction, `_tag` value, field access, structural
equality, and the `message` getter.

```typescript
import { describe, expect, it } from "vitest";
import { Data, Equal } from "effect";
import { InvalidVersionError } from "../src/errors/InvalidVersionError.js";
import { InvalidRangeError } from "../src/errors/InvalidRangeError.js";
import { InvalidComparatorError } from "../src/errors/InvalidComparatorError.js";
import { InvalidPrereleaseError } from "../src/errors/InvalidPrereleaseError.js";

describe("Parsing Errors", () => {
  describe("InvalidVersionError", () => {
    it("has correct _tag", () => {
      const err = new InvalidVersionError({
        input: "1.2.abc",
        position: 4,
      });
      expect(err._tag).toBe("InvalidVersionError");
    });

    it("exposes input and position fields", () => {
      const err = new InvalidVersionError({
        input: "01.0.0",
        position: 0,
      });
      expect(err.input).toBe("01.0.0");
      expect(err.position).toBe(0);
    });

    it("allows undefined position", () => {
      const err = new InvalidVersionError({ input: "" });
      expect(err.position).toBeUndefined();
    });

    it("derives message from fields", () => {
      const err = new InvalidVersionError({
        input: "1.2.abc",
        position: 4,
      });
      expect(err.message).toContain("1.2.abc");
      expect(err.message).toContain("4");
    });

    it("derives message without position", () => {
      const err = new InvalidVersionError({ input: "" });
      expect(err.message).toContain('""');
      expect(err.message).not.toContain("position");
    });

    it("supports structural equality", () => {
      const a = new InvalidVersionError({
        input: "bad",
        position: 0,
      });
      const b = new InvalidVersionError({
        input: "bad",
        position: 0,
      });
      expect(Equal.equals(a, b)).toBe(true);
    });

    it("is an instance of Error", () => {
      const err = new InvalidVersionError({ input: "x" });
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("InvalidRangeError", () => {
    it("has correct _tag", () => {
      const err = new InvalidRangeError({
        input: ">=1.0.0 <",
        position: 9,
      });
      expect(err._tag).toBe("InvalidRangeError");
    });

    it("exposes input and position fields", () => {
      const err = new InvalidRangeError({
        input: ">=1.0.0 <",
        position: 9,
      });
      expect(err.input).toBe(">=1.0.0 <");
      expect(err.position).toBe(9);
    });

    it("derives message from fields", () => {
      const err = new InvalidRangeError({
        input: ">=1.0.0 <",
        position: 9,
      });
      expect(err.message).toContain(">=1.0.0 <");
    });

    it("supports structural equality", () => {
      const a = new InvalidRangeError({
        input: "bad",
        position: 0,
      });
      const b = new InvalidRangeError({
        input: "bad",
        position: 0,
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });

  describe("InvalidComparatorError", () => {
    it("has correct _tag", () => {
      const err = new InvalidComparatorError({
        input: "!= 1.2.3",
        position: 0,
      });
      expect(err._tag).toBe("InvalidComparatorError");
    });

    it("exposes input and position fields", () => {
      const err = new InvalidComparatorError({
        input: ">= ",
        position: 3,
      });
      expect(err.input).toBe(">= ");
      expect(err.position).toBe(3);
    });

    it("derives message from fields", () => {
      const err = new InvalidComparatorError({
        input: "!= 1.2.3",
        position: 0,
      });
      expect(err.message).toContain("!= 1.2.3");
    });

    it("supports structural equality", () => {
      const a = new InvalidComparatorError({
        input: "x",
        position: 0,
      });
      const b = new InvalidComparatorError({
        input: "x",
        position: 0,
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });

  describe("InvalidPrereleaseError", () => {
    it("has correct _tag", () => {
      const err = new InvalidPrereleaseError({ input: "01" });
      expect(err._tag).toBe("InvalidPrereleaseError");
    });

    it("exposes input field", () => {
      const err = new InvalidPrereleaseError({ input: "alpha..beta" });
      expect(err.input).toBe("alpha..beta");
    });

    it("has no position field", () => {
      const err = new InvalidPrereleaseError({ input: "01" });
      expect("position" in err).toBe(false);
    });

    it("derives message from fields", () => {
      const err = new InvalidPrereleaseError({ input: "01" });
      expect(err.message).toContain("01");
    });

    it("supports structural equality", () => {
      const a = new InvalidPrereleaseError({ input: "01" });
      const b = new InvalidPrereleaseError({ input: "01" });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run __test__/errors.test.ts
```

Expected: FAIL -- modules don't exist yet.

### Task 4: Implement parsing error classes

**Files:**
- Create: `src/errors/InvalidVersionError.ts`
- Create: `src/errors/InvalidRangeError.ts`
- Create: `src/errors/InvalidComparatorError.ts`
- Create: `src/errors/InvalidPrereleaseError.ts`

- [ ] **Step 1: Implement InvalidVersionError**

Create `src/errors/InvalidVersionError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const InvalidVersionErrorBase = Data.TaggedError(
  "InvalidVersionError",
);

export class InvalidVersionError extends InvalidVersionErrorBase<{
  readonly input: string;
  readonly position?: number;
}> {
  get message(): string {
    const pos =
      this.position !== undefined
        ? ` at position ${this.position}`
        : "";
    return `Invalid version string: "${this.input}"${pos}`;
  }
}
```

- [ ] **Step 2: Implement InvalidRangeError**

Create `src/errors/InvalidRangeError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const InvalidRangeErrorBase = Data.TaggedError(
  "InvalidRangeError",
);

export class InvalidRangeError extends InvalidRangeErrorBase<{
  readonly input: string;
  readonly position?: number;
}> {
  get message(): string {
    const pos =
      this.position !== undefined
        ? ` at position ${this.position}`
        : "";
    return `Invalid range expression: "${this.input}"${pos}`;
  }
}
```

- [ ] **Step 3: Implement InvalidComparatorError**

Create `src/errors/InvalidComparatorError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const InvalidComparatorErrorBase = Data.TaggedError(
  "InvalidComparatorError",
);

export class InvalidComparatorError extends InvalidComparatorErrorBase<{
  readonly input: string;
  readonly position?: number;
}> {
  get message(): string {
    const pos =
      this.position !== undefined
        ? ` at position ${this.position}`
        : "";
    return `Invalid comparator: "${this.input}"${pos}`;
  }
}
```

- [ ] **Step 4: Implement InvalidPrereleaseError**

Create `src/errors/InvalidPrereleaseError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const InvalidPrereleaseErrorBase = Data.TaggedError(
  "InvalidPrereleaseError",
);

export class InvalidPrereleaseError extends InvalidPrereleaseErrorBase<{
  readonly input: string;
}> {
  get message(): string {
    return `Invalid prerelease identifier: "${this.input}"`;
  }
}
```

- [ ] **Step 5: Run parsing error tests**

```bash
pnpm vitest run __test__/errors.test.ts
```

Expected: All "Parsing Errors" tests PASS.

- [ ] **Step 6: Lint and typecheck**

```bash
pnpm run lint:fix && pnpm run typecheck
```

Expected: clean pass.

- [ ] **Step 7: Commit**

```bash
git add src/errors/Invalid*.ts __test__/errors.test.ts
git commit -m "feat: implement parsing error classes

Add InvalidVersionError, InvalidRangeError, InvalidComparatorError,
and InvalidPrereleaseError using the split base pattern. Each error
extends Data.TaggedError with structured fields and a derived message
getter. Tests cover _tag, field access, structural equality, and
message derivation.

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 3: Error Model -- Resolution & Constraint Errors

### Task 5: Write failing tests for resolution and constraint errors

**Files:**
- Modify: `__test__/errors.test.ts`

- [ ] **Step 1: Add tests for resolution and constraint errors**

Append to `__test__/errors.test.ts`. Add these imports at the top:

```typescript
import { UnsatisfiedRangeError } from "../src/errors/UnsatisfiedRangeError.js";
import { VersionNotFoundError } from "../src/errors/VersionNotFoundError.js";
import { EmptyCacheError } from "../src/errors/EmptyCacheError.js";
import { UnsatisfiableConstraintError } from "../src/errors/UnsatisfiableConstraintError.js";
import { InvalidBumpError } from "../src/errors/InvalidBumpError.js";
import { VersionFetchError } from "../src/errors/VersionFetchError.js";
```

Add these describe blocks inside the top-level describe or as new
top-level describes:

```typescript
describe("Resolution Errors", () => {
  describe("UnsatisfiedRangeError", () => {
    it("has correct _tag", () => {
      const err = new UnsatisfiedRangeError({
        range: ">=2.0.0" as any,
        available: [] as any,
      });
      expect(err._tag).toBe("UnsatisfiedRangeError");
    });

    it("exposes range and available fields", () => {
      const range = ">=2.0.0" as any;
      const available = ["1.0.0", "1.5.0"] as any;
      const err = new UnsatisfiedRangeError({ range, available });
      expect(err.range).toBe(range);
      expect(err.available).toBe(available);
    });

    it("derives message from fields", () => {
      const err = new UnsatisfiedRangeError({
        range: ">=2.0.0" as any,
        available: [] as any,
      });
      expect(err.message).toBeDefined();
      expect(typeof err.message).toBe("string");
    });

    it("supports structural equality", () => {
      const a = new UnsatisfiedRangeError({
        range: "x" as any,
        available: [] as any,
      });
      const b = new UnsatisfiedRangeError({
        range: "x" as any,
        available: [] as any,
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });

  describe("VersionNotFoundError", () => {
    it("has correct _tag", () => {
      const err = new VersionNotFoundError({
        version: "1.0.0" as any,
      });
      expect(err._tag).toBe("VersionNotFoundError");
    });

    it("exposes version field", () => {
      const version = "1.0.0" as any;
      const err = new VersionNotFoundError({ version });
      expect(err.version).toBe(version);
    });

    it("derives message from fields", () => {
      const err = new VersionNotFoundError({
        version: "1.0.0" as any,
      });
      expect(err.message).toBeDefined();
    });

    it("supports structural equality", () => {
      const a = new VersionNotFoundError({
        version: "x" as any,
      });
      const b = new VersionNotFoundError({
        version: "x" as any,
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });

  describe("EmptyCacheError", () => {
    it("has correct _tag", () => {
      const err = new EmptyCacheError({});
      expect(err._tag).toBe("EmptyCacheError");
    });

    it("has no domain fields", () => {
      const err = new EmptyCacheError({});
      expect(err._tag).toBe("EmptyCacheError");
    });

    it("derives message", () => {
      const err = new EmptyCacheError({});
      expect(err.message).toBeDefined();
      expect(typeof err.message).toBe("string");
    });

    it("supports structural equality", () => {
      const a = new EmptyCacheError({});
      const b = new EmptyCacheError({});
      expect(Equal.equals(a, b)).toBe(true);
    });
  });
});

describe("Constraint Errors", () => {
  describe("UnsatisfiableConstraintError", () => {
    it("has correct _tag", () => {
      const err = new UnsatisfiableConstraintError({
        constraints: [] as any,
      });
      expect(err._tag).toBe("UnsatisfiableConstraintError");
    });

    it("exposes constraints field", () => {
      const constraints = [">=2.0.0", "<1.0.0"] as any;
      const err = new UnsatisfiableConstraintError({ constraints });
      expect(err.constraints).toBe(constraints);
    });

    it("derives message from fields", () => {
      const err = new UnsatisfiableConstraintError({
        constraints: [] as any,
      });
      expect(err.message).toBeDefined();
    });

    it("supports structural equality", () => {
      const a = new UnsatisfiableConstraintError({
        constraints: [] as any,
      });
      const b = new UnsatisfiableConstraintError({
        constraints: [] as any,
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });

  describe("InvalidBumpError", () => {
    it("has correct _tag", () => {
      const err = new InvalidBumpError({
        version: "1.0.0" as any,
        type: "release",
      });
      expect(err._tag).toBe("InvalidBumpError");
    });

    it("exposes version and type fields", () => {
      const err = new InvalidBumpError({
        version: "1.0.0" as any,
        type: "prerelease",
      });
      expect(err.version).toBe("1.0.0");
      expect(err.type).toBe("prerelease");
    });

    it("derives message from fields", () => {
      const err = new InvalidBumpError({
        version: "1.0.0" as any,
        type: "release",
      });
      expect(err.message).toContain("release");
    });

    it("supports structural equality", () => {
      const a = new InvalidBumpError({
        version: "x" as any,
        type: "major",
      });
      const b = new InvalidBumpError({
        version: "x" as any,
        type: "major",
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });

  describe("VersionFetchError", () => {
    it("has correct _tag", () => {
      const err = new VersionFetchError({
        source: "npm",
        message: "404 Not Found",
      });
      expect(err._tag).toBe("VersionFetchError");
    });

    it("exposes source and message fields", () => {
      const err = new VersionFetchError({
        source: "github",
        message: "Rate limited",
      });
      expect(err.source).toBe("github");
      expect(err.message).toContain("Rate limited");
    });

    it("accepts optional cause", () => {
      const cause = new Error("network");
      const err = new VersionFetchError({
        source: "npm",
        message: "Failed",
        cause,
      });
      expect(err.cause).toBe(cause);
    });

    it("allows undefined cause", () => {
      const err = new VersionFetchError({
        source: "npm",
        message: "Failed",
      });
      expect(err.cause).toBeUndefined();
    });

    it("supports structural equality", () => {
      const a = new VersionFetchError({
        source: "npm",
        message: "x",
      });
      const b = new VersionFetchError({
        source: "npm",
        message: "x",
      });
      expect(Equal.equals(a, b)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
pnpm vitest run __test__/errors.test.ts
```

Expected: FAIL -- resolution/constraint error modules don't exist yet.
The parsing error tests should still pass if they were committed.

### Task 6: Implement resolution error classes

**Files:**
- Create: `src/errors/UnsatisfiedRangeError.ts`
- Create: `src/errors/VersionNotFoundError.ts`
- Create: `src/errors/EmptyCacheError.ts`

- [ ] **Step 1: Implement UnsatisfiedRangeError**

Create `src/errors/UnsatisfiedRangeError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const UnsatisfiedRangeErrorBase = Data.TaggedError(
  "UnsatisfiedRangeError",
);

export class UnsatisfiedRangeError extends UnsatisfiedRangeErrorBase<{
  readonly range: unknown;
  readonly available: ReadonlyArray<unknown>;
}> {
  get message(): string {
    const count = this.available.length;
    return `No version satisfies range ${String(this.range)} (${count} version${count === 1 ? "" : "s"} available)`;
  }
}
```

Note: `range` and `available` use `unknown` for now. They will be
narrowed to `Range` and `ReadonlyArray<SemVer>` in Phase 2 when the
schema types exist. This avoids circular dependencies.

- [ ] **Step 2: Implement VersionNotFoundError**

Create `src/errors/VersionNotFoundError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const VersionNotFoundErrorBase = Data.TaggedError(
  "VersionNotFoundError",
);

export class VersionNotFoundError extends VersionNotFoundErrorBase<{
  readonly version: unknown;
}> {
  get message(): string {
    return `Version not found in cache: ${String(this.version)}`;
  }
}
```

Note: `version` uses `unknown` for now, narrowed to `SemVer` in Phase 2.

- [ ] **Step 3: Implement EmptyCacheError**

Create `src/errors/EmptyCacheError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const EmptyCacheErrorBase = Data.TaggedError("EmptyCacheError");

export class EmptyCacheError extends EmptyCacheErrorBase<{}> {
  get message(): string {
    return "Version cache is empty";
  }
}
```

- [ ] **Step 4: Run resolution error tests**

```bash
pnpm vitest run __test__/errors.test.ts
```

Expected: All "Resolution Errors" tests PASS. Constraint errors still
fail.

### Task 7: Implement constraint error classes

**Files:**
- Create: `src/errors/UnsatisfiableConstraintError.ts`
- Create: `src/errors/InvalidBumpError.ts`
- Create: `src/errors/VersionFetchError.ts`

- [ ] **Step 1: Implement UnsatisfiableConstraintError**

Create `src/errors/UnsatisfiableConstraintError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const UnsatisfiableConstraintErrorBase = Data.TaggedError(
  "UnsatisfiableConstraintError",
);

export class UnsatisfiableConstraintError extends UnsatisfiableConstraintErrorBase<{
  readonly constraints: ReadonlyArray<unknown>;
}> {
  get message(): string {
    const count = this.constraints.length;
    return `No version satisfies all ${count} constraint${count === 1 ? "" : "s"}`;
  }
}
```

Note: `constraints` uses `ReadonlyArray<unknown>` for now, narrowed to
`ReadonlyArray<Range>` in Phase 2.

- [ ] **Step 2: Implement InvalidBumpError**

Create `src/errors/InvalidBumpError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const InvalidBumpErrorBase = Data.TaggedError("InvalidBumpError");

export class InvalidBumpError extends InvalidBumpErrorBase<{
  readonly version: unknown;
  readonly type: string;
}> {
  get message(): string {
    return `Cannot apply ${this.type} bump to version ${String(this.version)}`;
  }
}
```

- [ ] **Step 3: Implement VersionFetchError**

Create `src/errors/VersionFetchError.ts`:

```typescript
import { Data } from "effect";

/** @internal */
export const VersionFetchErrorBase = Data.TaggedError(
  "VersionFetchError",
);

export class VersionFetchError extends VersionFetchErrorBase<{
  readonly source: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}
```

Note: VersionFetchError uses the `message` field directly from
construction rather than a getter, since the message is provided by
the consumer's fetcher implementation (it's not derivable from other
fields).

- [ ] **Step 4: Run all error tests**

```bash
pnpm vitest run __test__/errors.test.ts
```

Expected: ALL tests PASS.

- [ ] **Step 5: Lint and typecheck**

```bash
pnpm run lint:fix && pnpm run typecheck
```

Expected: clean pass.

- [ ] **Step 6: Commit**

```bash
git add src/errors/ __test__/errors.test.ts
git commit -m "feat: implement complete error model with 10 error classes

Add resolution errors (UnsatisfiedRangeError, VersionNotFoundError,
EmptyCacheError) and constraint errors (UnsatisfiableConstraintError,
InvalidBumpError, VersionFetchError). All use the split base pattern
for api-extractor compatibility. Domain object fields use unknown
temporarily until schema types are available in Phase 2.

Closes #11

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 4: Barrel Export & Final Verification

### Task 8: Add error exports to barrel

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add all error class re-exports to index.ts**

Add to `src/index.ts` after the docblock:

```typescript
// Errors -- Parsing
export { InvalidVersionError } from "./errors/InvalidVersionError.js";
export { InvalidRangeError } from "./errors/InvalidRangeError.js";
export { InvalidComparatorError } from "./errors/InvalidComparatorError.js";
export { InvalidPrereleaseError } from "./errors/InvalidPrereleaseError.js";

// Errors -- Resolution
export { UnsatisfiedRangeError } from "./errors/UnsatisfiedRangeError.js";
export { VersionNotFoundError } from "./errors/VersionNotFoundError.js";
export { EmptyCacheError } from "./errors/EmptyCacheError.js";

// Errors -- Constraint
export { UnsatisfiableConstraintError } from "./errors/UnsatisfiableConstraintError.js";
export { InvalidBumpError } from "./errors/InvalidBumpError.js";

// Errors -- Fetch
export { VersionFetchError } from "./errors/VersionFetchError.js";
```

Important: Do NOT export the `*Base` constants. Those are `@internal`.

- [ ] **Step 2: Run full test suite**

```bash
pnpm run test
```

Expected: all tests pass.

- [ ] **Step 3: Run lint, typecheck, and build**

```bash
pnpm run lint:fix && pnpm run typecheck && pnpm run build
```

Expected: all pass cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: export all error classes from barrel

Re-export all 10 error classes from src/index.ts. Base constants
are excluded (@internal).

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `pnpm run test` -- all tests pass
- [ ] `pnpm run typecheck` -- no type errors
- [ ] `pnpm run lint` -- no lint errors
- [ ] `pnpm run build` -- builds successfully
- [ ] 10 error files exist in `src/errors/`
- [ ] Each error uses split base pattern (`*Base` + class)
- [ ] Each error has a `message` getter (except VersionFetchError which
  takes message as a field)
- [ ] `src/index.ts` exports all 10 error classes (not bases)
- [ ] `__test__/errors.test.ts` covers all 10 errors
- [ ] No barrel files exist except `src/index.ts`
- [ ] Template placeholder code (`Bar`, `Foo`) is gone
