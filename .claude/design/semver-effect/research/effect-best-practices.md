# Effect Best Practices Research for semver-effect

Research conducted 2026-03-10. Based on Effect documentation at
effect.website, the Effect source code, and the semver-effect design
documents.

---

## Table of Contents

1. [Schema.TaggedClass Usage](#1-schemataggedclass-usage)
2. [Service Pattern: Context.GenericTag vs Context.Tag](#2-service-pattern-contextgenerictag-vs-contexttag)
3. [Error Pattern: Data.TaggedError](#3-error-pattern-datataggederror)
4. [Ref + SortedSet for VersionCache](#4-ref--sortedset-for-versioncache)
5. [Order Instance for SemVer](#5-order-instance-for-semver)
6. [Testing Effect Services](#6-testing-effect-services)
7. [Code Style Recommendations](#7-code-style-recommendations)
8. [Concerns and Suggestions](#8-concerns-and-suggestions)

---

## 1. Schema.TaggedClass Usage

### How Schema.TaggedClass Works

`Schema.TaggedClass` is a variant of `Schema.Class` that automatically adds
a `_tag` literal field to the schema. The pattern is:

```typescript
class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
  major: Schema.NonNegativeInt,
  minor: Schema.NonNegativeInt,
  patch: Schema.NonNegativeInt,
  prerelease: Schema.Array(Schema.Union(Schema.String, Schema.NonNegativeInt)),
  build: Schema.Array(Schema.String),
}) {}
```

Key properties:

- The first argument to the returned function (`"SemVer"`) becomes the
  `_tag` literal value, automatically added to every instance
- The class IS its own Schema -- you can pass `SemVer` directly to
  `Schema.decodeUnknownSync`, `Schema.encode`, etc.
- Instances are frozen (immutable)
- The constructor validates inputs through the schema (unless
  `disableValidation` is passed)

### Equal/Hash from Data.Class

`Schema.TaggedClass` (and `Schema.Class`) integrate with `Data.Class`,
which means instances automatically get:

- **Equal trait:** Structural equality comparing all fields by value
- **Hash trait:** Hash derived from all fields

**Gotcha -- shallow equality.** The default Equal implementation from
`Data.Class` performs **shallow** structural equality. For nested objects
or arrays, this means reference comparison on the nested values unless
those values themselves implement Equal. For our `prerelease` and `build`
arrays, this is a concern.

**Recommendation:** Use `Schema.Data(Schema.Array(...))` for the
`prerelease` and `build` fields to ensure the arrays themselves are
wrapped with Data's structural equality. Alternatively, override
`[Equal.symbol]` directly on the class.

### Custom Equal That Ignores Build Metadata

The SemVer 2.0.0 spec requires that build metadata is ignored for equality.
The default `Data.Class` equality compares ALL fields, including `build`.
We MUST override this.

**Implementation approach:**

```typescript
import { Equal, Hash } from "effect"

class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", {
  major: Schema.NonNegativeInt,
  minor: Schema.NonNegativeInt,
  patch: Schema.NonNegativeInt,
  prerelease: Schema.Array(Schema.Union(Schema.String, Schema.NonNegativeInt)),
  build: Schema.Array(Schema.String),
}) {
  [Equal.symbol](that: Equal.Equal): boolean {
    if (!(that instanceof SemVer)) return false
    return (
      this.major === that.major &&
      this.minor === that.minor &&
      this.patch === that.patch &&
      this.prerelease.length === that.prerelease.length &&
      this.prerelease.every((v, i) => v === that.prerelease[i])
    )
  }

  [Hash.symbol](): number {
    let h = Hash.hash(this.major)
    h = Hash.combine(h)(Hash.hash(this.minor))
    h = Hash.combine(h)(Hash.hash(this.patch))
    for (const id of this.prerelease) {
      h = Hash.combine(h)(Hash.hash(id))
    }
    return h
  }
}
```

**Key points:**

- `[Equal.symbol]` receives `Equal.Equal`, so you must narrow with
  `instanceof`
- `[Hash.symbol]` must return a `number`
- Use `Hash.combine(existingHash)(Hash.hash(nextValue))` to combine
  multiple hash components -- `Hash.combine` is curried
- **Critical:** Hash MUST be consistent with Equal. If `build` is
  excluded from Equal, it MUST also be excluded from Hash. Two values
  that are Equal MUST have the same Hash.
- The prerelease array comparison must be element-wise with strict type
  checking (`===` ensures `1 !== "1"`)

### Adding Methods to TaggedClass

Methods and getters can be added directly to the class body:

```typescript
class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", { ... }) {
  get isPrerelease(): boolean {
    return this.prerelease.length > 0
  }

  toString(): string {
    let s = `${this.major}.${this.minor}.${this.patch}`
    if (this.prerelease.length > 0) s += `-${this.prerelease.join(".")}`
    if (this.build.length > 0) s += `+${this.build.join(".")}`
    return s
  }
}
```

For **Inspectable**, override `toString()` or implement
`[Inspectable.NodeInspectSymbol]()` to control how the value appears in
`console.log` and Effect's debugging output.

### Static Methods (Bump Operations)

Static methods can be added to the class or defined as standalone
functions. For the bump operations planned in the design docs, standalone
functions are cleaner because they return new instances:

```typescript
// Option A: Static methods on the class
class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", { ... }) {
  static bumpMajor(v: SemVer): SemVer {
    return new SemVer({ major: v.major + 1, minor: 0, patch: 0, prerelease: [], build: [] })
  }
}

// Option B: Module-level functions (more idiomatic in Effect)
export const bumpMajor = (v: SemVer): SemVer =>
  new SemVer({ major: v.major + 1, minor: 0, patch: 0, prerelease: [], build: [] })
```

**Recommendation:** The design docs specify `SemVer.bump.major(v)` as a
namespace. This can be achieved with a static property that holds an
object of functions:

```typescript
class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", { ... }) {
  static readonly bump = {
    major: (v: SemVer): SemVer => new SemVer({ ... }),
    minor: (v: SemVer): SemVer => new SemVer({ ... }),
    patch: (v: SemVer): SemVer => new SemVer({ ... }),
    prerelease: (v: SemVer, id?: string): SemVer => new SemVer({ ... }),
    release: (v: SemVer): SemVer => new SemVer({ ... }),
  }
}
```

### Schema Validation Gotcha

The `Schema.NonNegativeInt` brand applies at decode time. When
constructing via `new SemVer({ major: 1, ... })`, the constructor runs
schema validation by default. This means:

- `new SemVer({ major: -1, ... })` will throw at construction time
- This is good for safety but could be a performance concern in hot paths
  (e.g., the parser creating many SemVer instances)
- Pass `{ disableValidation: true }` as the second argument to the
  constructor to skip validation when you know the values are valid
  (e.g., internal parser code that has already validated)

```typescript
// Internal parser -- values already validated
new SemVer(
  { major, minor, patch, prerelease, build },
  { disableValidation: true }
)
```

---

## 2. Service Pattern: Context.GenericTag vs Context.Tag

### Current Recommended Pattern: Context.Tag (Class-based)

The **modern Effect pattern** uses a class-based `Context.Tag`:

```typescript
class SemVerParser extends Context.Tag("SemVerParser")<
  SemVerParser,
  {
    readonly parseVersion: (input: string) => Effect.Effect<SemVer, InvalidVersionError>
    readonly parseRange: (input: string) => Effect.Effect<Range, InvalidRangeError>
    readonly parseComparator: (input: string) => Effect.Effect<Comparator, InvalidComparatorError>
  }
>() {}
```

This is the pattern shown in the official Effect documentation. The class
extends `Context.Tag(identifier)<Self, Shape>()` where:

- `identifier` is a global string key (survives module reloads)
- First generic is the class itself (self-referencing)
- Second generic is the service shape (the interface)

### Context.GenericTag

`Context.GenericTag` is a **function-based** alternative that creates a
tag without a class:

```typescript
export interface SemVerParser {
  readonly parseVersion: (input: string) => Effect.Effect<SemVer, InvalidVersionError>
  readonly parseRange: (input: string) => Effect.Effect<Range, InvalidRangeError>
}

export const SemVerParser = Context.GenericTag<SemVerParser>("SemVerParser")
```

**Status of GenericTag:** It is still available in the Effect API but is
not the pattern shown in the official documentation. The class-based
`Context.Tag` is the documented, recommended approach.

### The api-extractor Problem

The design docs note that `Context.Tag` produces un-nameable `_base`
types that break api-extractor's declaration bundling. This is a real
concern. The class-based Tag pattern generates internal types that
api-extractor cannot resolve when re-exported.

**GenericTag avoids this** because it returns a simple value (no class
hierarchy with internal base types).

### Recommendation

The plan to use `Context.GenericTag` is **pragmatically correct** given
the api-extractor constraint. The two approaches are functionally
equivalent at runtime. The key differences are:

1. **Class-based Tag** (recommended by docs):
   - Single declaration (interface + tag in one class)
   - Slightly cleaner import pattern (just import the class)
   - Has `_base` type that can break api-extractor

2. **GenericTag** (planned in our design):
   - Separate interface + tag constant
   - Works with api-extractor
   - Slightly more verbose but explicit

**If api-extractor is a hard requirement**, stick with `GenericTag`. The
pattern is stable and not deprecated. If api-extractor is dropped in the
future, migration to class-based Tag is straightforward.

### Layer Pattern

Both approaches use the same Layer pattern:

```typescript
// With GenericTag
export const SemVerParserLive = Layer.succeed(SemVerParser, {
  parseVersion: (input) => Effect.gen(function* () { ... }),
  parseRange: (input) => Effect.gen(function* () { ... }),
  parseComparator: (input) => Effect.gen(function* () { ... }),
})

// For VersionCache (needs Ref allocation, so use Layer.effect)
export const VersionCacheLive = Layer.effect(
  VersionCache,
  Effect.gen(function* () {
    const ref = yield* Ref.make(SortedSet.empty(SemVerOrder))
    return {
      load: (versions) => Ref.set(ref, SortedSet.fromIterable(versions, SemVerOrder)),
      add: (version) => Ref.update(ref, SortedSet.add(version)),
      // ... etc
    }
  })
)
```

**Layer.succeed** is for stateless services (no setup Effect needed).
**Layer.effect** is for services that need effectful initialization (like
allocating a Ref).

### Best Practice: Service Methods Should Return Effect<A, E, never>

Service methods should NOT leak their internal dependencies into the
return type. The `R` parameter in method return types should be `never`.
Dependencies belong in the Layer, not in the method signatures:

```typescript
// GOOD: no requirements in method return type
interface VersionCache {
  readonly resolve: (range: Range) => Effect.Effect<SemVer, UnsatisfiedRangeError>
}

// BAD: leaking SemVerParser dependency into method signature
interface VersionCache {
  readonly resolveString: (input: string) => Effect.Effect<SemVer, InvalidRangeError | UnsatisfiedRangeError, SemVerParser>
}
```

For `resolveString`, the Layer implementation should capture the
SemVerParser dependency at construction time (in the `make` Effect), not
expose it through the method signature.

---

## 3. Error Pattern: Data.TaggedError

### Current Best Practice

`Data.TaggedError` is the standard and recommended way to define typed
errors in Effect. The pattern is:

```typescript
class InvalidVersionError extends Data.TaggedError("InvalidVersionError")<{
  readonly input: string
  readonly position?: number
}> {}
```

This gives you:

- `_tag: "InvalidVersionError"` discriminator field
- Structural equality (two errors with same fields are Equal)
- Works with `Effect.catchTag("InvalidVersionError", handler)`
- Works with `Effect.catchTags({ InvalidVersionError: handler, ... })`
- Extends `Error` (has `.message`, `.stack`)

### Split Base Pattern Assessment

The design docs plan a "split base" pattern for api-extractor:

```typescript
/** @internal */
export const InvalidVersionErrorBase = Data.TaggedError("InvalidVersionError")

export class InvalidVersionError extends InvalidVersionErrorBase<{
  readonly input: string
  readonly position?: number
}> {}
```

**Assessment:** This pattern is correct and necessary when using
api-extractor. The `Data.TaggedError("...")` call returns a class
constructor, and assigning it to a named constant gives api-extractor a
stable reference. The `@internal` JSDoc prevents the base from appearing
in the public API docs while still allowing export for the declaration
bundler.

### Providing a Custom Message

`Data.TaggedError` instances have a `message` property inherited from
`Error`. To provide a meaningful message, you can either:

Option A -- Override message in the constructor call:

```typescript
new InvalidVersionError({
  input: "1.2",
  position: 3,
  message: `Expected patch version at position 3 in "1.2"`
})
```

Option B -- Use a getter to derive message from fields:

```typescript
class InvalidVersionError extends InvalidVersionErrorBase<{
  readonly input: string
  readonly position?: number
}> {
  get message(): string {
    const pos = this.position !== undefined ? ` at position ${this.position}` : ""
    return `Invalid version string: "${this.input}"${pos}`
  }
}
```

**Recommendation:** Option B is cleaner because the message is always
consistent with the structured fields. However, be aware that `message`
is part of the Error prototype chain and the getter approach may have
edge cases with serialization.

### No Newer Patterns

As of the current Effect release, `Data.TaggedError` remains the standard.
There is no newer replacement. The flat hierarchy (no intermediate abstract
error class) is idiomatic -- Effect error handling relies on union types
and `_tag` discrimination, not class inheritance hierarchies.

---

## 4. Ref + SortedSet for VersionCache

### Ref Basics

`Ref<A>` is a mutable reference holding an immutable value. Core API:

- `Ref.make(initial)` -- create a new Ref (returns an Effect)
- `Ref.get(ref)` -- read current value (returns Effect)
- `Ref.set(ref, value)` -- replace value (returns `Effect<void>`)
- `Ref.update(ref, fn)` -- atomically transform value (returns `Effect<void>`)
- `Ref.modify(ref, fn)` -- transform and return a derived value

**Fiber safety:** All Ref operations are atomic at the fiber level. Two
concurrent `Ref.update` calls will both succeed without data corruption.
No explicit locking is needed.

### SortedSet

`SortedSet` is an immutable sorted collection parameterized by an
`Order`. Key operations:

- `SortedSet.empty(order)` -- create empty set with given Order
- `SortedSet.fromIterable(items, order)` -- create from iterable
- `SortedSet.add(value)(set)` -- returns new set with value added
- `SortedSet.remove(value)(set)` -- returns new set with value removed
- `SortedSet.has(value)(set)` -- check membership
- `SortedSet.values(set)` -- iterate in order
- `SortedSet.map(set, fn)` -- transform values (result re-sorted)
- `SortedSet.filter(set, pred)` -- filter values

**Note:** SortedSet operations use the provided Order for sorting AND
the Equal/Hash traits of the elements for deduplication. This means our
custom Equal (which ignores build metadata) is critical -- two versions
differing only in build metadata will be treated as the same element.

### Is `Ref<SortedSet<SemVer>>` the Right Choice?

**Yes, this is a good choice.** The rationale in the version-cache design
doc is sound:

1. **O(log n) insert/remove/lookup** -- SortedSet is backed by a balanced
   tree (red-black tree internally)
2. **Always sorted** -- no need to sort on every query
3. **Immutable snapshots** -- Ref.get returns an immutable value, so
   readers never see partial updates
4. **Structural sharing** -- SortedSet.add/remove produce new trees that
   share structure with the old tree, keeping allocation cheap

**Alternative considered: `Ref<Chunk<SemVer>>` with manual sorting.**
This would be worse because Chunk is an ordered sequence (like Array),
so maintaining sort order would require binary search insertion (O(n) for
the copy) or re-sorting after each add (O(n log n)).

**Alternative considered: `SynchronizedRef` instead of `Ref`.** Use
`SynchronizedRef` only if you need effectful updates (where the update
function itself returns an Effect). For VersionCache, all mutations are
pure (SortedSet.add, SortedSet.remove), so plain `Ref` is correct and
more performant.

### Creating SortedSet with Custom Order

```typescript
import { SortedSet } from "effect"
import { SemVerOrder } from "../order.js"

const emptyCache = SortedSet.empty(SemVerOrder)
const populated = SortedSet.fromIterable(versions, SemVerOrder)
```

### Iterating in Reverse (for resolve)

The `resolve` method needs to iterate in descending order to find the
highest matching version. `SortedSet.values` iterates in ascending order.
Options:

1. Convert to array and reverse: `Array.from(SortedSet.values(set)).reverse()`
2. Use `SortedSet.reduce` starting from the end (if available)
3. Convert to `Chunk` and use `Chunk.reverse`

**Recommendation:** Convert to a `ReadonlyArray` via
`Array.from(SortedSet.values(set))` and then iterate from the end. This
is O(n) but only happens on resolve calls, not on every mutation. For
the common case where the highest matching version is near the top, you
could also iterate the array from the end with a simple loop.

---

## 5. Order Instance for SemVer

### Defining a Custom Order

Use `Order.make` to create a custom Order:

```typescript
import { Order } from "effect"

export const SemVerOrder: Order.Order<SemVer> = Order.make((self, that) => {
  // 1. Compare major
  if (self.major !== that.major) return self.major < that.major ? -1 : 1

  // 2. Compare minor
  if (self.minor !== that.minor) return self.minor < that.minor ? -1 : 1

  // 3. Compare patch
  if (self.patch !== that.patch) return self.patch < that.patch ? -1 : 1

  // 4. Prerelease vs no-prerelease
  const selfHasPre = self.prerelease.length > 0
  const thatHasPre = that.prerelease.length > 0
  if (!selfHasPre && thatHasPre) return 1   // no prerelease > prerelease
  if (selfHasPre && !thatHasPre) return -1  // prerelease < no prerelease
  if (!selfHasPre && !thatHasPre) return 0  // both release, equal

  // 5. Compare prerelease identifiers left to right
  const len = Math.min(self.prerelease.length, that.prerelease.length)
  for (let i = 0; i < len; i++) {
    const a = self.prerelease[i]
    const b = that.prerelease[i]
    if (a === b) continue

    const aIsNum = typeof a === "number"
    const bIsNum = typeof b === "number"

    // Numeric always lower precedence than alphanumeric
    if (aIsNum && !bIsNum) return -1
    if (!aIsNum && bIsNum) return 1

    // Both numeric: compare as integers
    if (aIsNum && bIsNum) return a < b ? -1 : 1

    // Both string: compare as ASCII
    return (a as string) < (b as string) ? -1 : 1
  }

  // 6. Shorter prerelease array has lower precedence
  if (self.prerelease.length !== that.prerelease.length) {
    return self.prerelease.length < that.prerelease.length ? -1 : 1
  }

  return 0
})
```

**Important:** Build metadata does NOT affect ordering per SemVer 2.0.0
spec. The Order function ignores the `build` field entirely.

### Using Order with Effect Utilities

Once defined, the Order can be used with:

- `Array.sort(versions, SemVerOrder)` -- sort an array
- `SortedSet.empty(SemVerOrder)` -- create a sorted set
- `Order.lessThan(SemVerOrder)(a, b)` -- comparison predicate
- `Order.greaterThan(SemVerOrder)(a, b)` -- comparison predicate
- `Order.min(SemVerOrder)(a, b)` -- return minimum
- `Order.max(SemVerOrder)(a, b)` -- return maximum
- `Order.clamp(SemVerOrder)({ minimum, maximum })(v)` -- clamp to range
- `Order.between(SemVerOrder)({ minimum, maximum })(v)` -- range check
- `Order.reverse(SemVerOrder)` -- reversed Order (descending)

### Composing Orders

If you needed to sort by a secondary criterion (not needed for SemVer
since the spec defines a total order), you could use `Order.combine`:

```typescript
const byMajorThenName = Order.combine(
  Order.mapInput(Order.number, (v: SemVer) => v.major),
  Order.mapInput(Order.string, (v: SemVer) => v.toString())
)
```

### Exposing the Order

The `SemVerOrder` should be exported from `src/order.ts` as specified in
the data-model design doc. It should also be re-exported from
`src/index.ts` as part of the public API so consumers can use it for
their own sorting needs.

---

## 6. Testing Effect Services

### Running Effects in Tests

With Vitest, use `Effect.runPromise` or `Effect.runSync` to execute
Effects in test cases:

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"

describe("SemVerParser", () => {
  it("parses a valid version", async () => {
    const result = await Effect.runPromise(
      SemVerParser.parseVersion("1.2.3").pipe(
        Effect.provide(SemVerParserLive)
      )
    )
    expect(result.major).toBe(1)
    expect(result.minor).toBe(2)
    expect(result.patch).toBe(3)
  })
})
```

### Providing Layers in Tests

Create a shared Layer for test suites:

```typescript
const TestLayer = Layer.merge(SemVerParserLive, VersionCacheLive)

const runTest = <A, E>(effect: Effect.Effect<A, E, SemVerParser | VersionCache>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer))

it("resolves a range", async () => {
  const result = await runTest(
    Effect.gen(function* () {
      const cache = yield* VersionCache
      yield* cache.load([v100, v110, v200])
      return yield* cache.resolve(rangeGte1Lt2)
    })
  )
  expect(Equal.equals(result, v110)).toBe(true)
})
```

### Asserting Typed Errors

Use `Effect.runPromiseExit` to inspect the error channel:

```typescript
import { Effect, Exit, Cause } from "effect"

it("fails with InvalidVersionError for bad input", async () => {
  const exit = await Effect.runPromiseExit(
    SemVerParser.parseVersion("not-a-version").pipe(
      Effect.provide(SemVerParserLive)
    )
  )

  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) {
    const error = Cause.failureOption(exit.cause)
    expect(error._tag).toBe("Some")
    if (error._tag === "Some") {
      expect(error.value._tag).toBe("InvalidVersionError")
      expect(error.value.input).toBe("not-a-version")
    }
  }
})
```

**Cleaner approach with Effect.either:**

```typescript
it("fails with InvalidVersionError for bad input", async () => {
  const result = await Effect.runPromise(
    SemVerParser.parseVersion("not-a-version").pipe(
      Effect.either,
      Effect.provide(SemVerParserLive)
    )
  )

  expect(result._tag).toBe("Left")
  if (result._tag === "Left") {
    expect(result.left._tag).toBe("InvalidVersionError")
    expect(result.left.input).toBe("not-a-version")
  }
})
```

### Testing with Ref State

For VersionCache tests, you can create a pre-populated Layer:

```typescript
const makeTestCache = (versions: ReadonlyArray<SemVer>) =>
  Layer.effect(
    VersionCache,
    Effect.gen(function* () {
      const ref = yield* Ref.make(SortedSet.fromIterable(versions, SemVerOrder))
      return { /* ... service methods closing over ref ... */ }
    })
  )

it("finds latest version", async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const cache = yield* VersionCache
      return yield* cache.latest()
    }).pipe(
      Effect.provide(makeTestCache([v100, v110, v200]))
    )
  )
  expect(Equal.equals(result, v200)).toBe(true)
})
```

### Testing Equal/Hash/Order

```typescript
describe("SemVer equality", () => {
  it("treats versions differing only in build as equal", () => {
    const a = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: ["001"] })
    const b = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: ["exp"] })
    expect(Equal.equals(a, b)).toBe(true)
    expect(Hash.hash(a)).toBe(Hash.hash(b))
  })

  it("treats versions with different prerelease as not equal", () => {
    const a = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["alpha"], build: [] })
    const b = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["beta"], build: [] })
    expect(Equal.equals(a, b)).toBe(false)
  })
})

describe("SemVer ordering", () => {
  it("follows spec clause 11 precedence", () => {
    const versions = [
      new SemVer({ major: 1, minor: 0, patch: 0, prerelease: [], build: [] }),
      new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["alpha"], build: [] }),
      new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["alpha", 1], build: [] }),
      new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["beta", 2], build: [] }),
      new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["rc", 1], build: [] }),
    ]
    const sorted = Array.sort(versions, SemVerOrder)
    // alpha < alpha.1 < beta.2 < rc.1 < 1.0.0
    expect(sorted[0].prerelease).toEqual(["alpha"])
    expect(sorted[4].prerelease).toEqual([])
  })
})
```

### Vitest Configuration Note

The design docs mention using `forks` pool for Effect compatibility.
This is correct -- Effect's fiber runtime can conflict with Vitest's
`threads` pool. Ensure `vitest.config.ts` has:

```typescript
export default defineConfig({
  test: {
    pool: "forks",
  },
})
```

---

## 7. Code Style Recommendations

### Import Patterns

Follow the Effect ecosystem convention of importing from the top-level
`effect` package:

```typescript
// GOOD: Named imports from "effect"
import { Effect, Schema, Data, Context, Layer, Ref, Equal, Hash, Order } from "effect"

// GOOD: Type-only imports separated
import type { SemVer } from "./schemas/SemVer.js"

// BAD: Deep imports (these are internal)
import { TaggedClass } from "effect/Schema"
```

For internal project imports, use `.js` extensions as required by ESM:

```typescript
import { SemVer } from "./schemas/SemVer.js"
import { SemVerOrder } from "./order.js"
import { InvalidVersionError } from "./errors/InvalidVersionError.js"
```

### Module Organization

The planned layout matches Effect conventions well:

- `schemas/` for data types (Schema.TaggedClass)
- `services/` for service interfaces + tags
- `layers/` for Layer implementations
- `errors/` for TaggedError classes
- `utils/` for pure helper functions

### Naming Conventions

Effect ecosystem naming:

- **Types/Classes:** PascalCase (`SemVer`, `Range`, `Comparator`)
- **Service tags:** Same name as interface (`SemVerParser`, `VersionCache`)
- **Layer implementations:** `*Live` suffix (`SemVerParserLive`,
  `VersionCacheLive`)
- **Test layers:** `*Test` suffix (`VersionCacheTest`)
- **Order instances:** `*Order` suffix or just `Order` if unambiguous
  (`SemVerOrder`)
- **Error classes:** Descriptive, ending in `Error`
  (`InvalidVersionError`)
- **Effect functions:** camelCase, verb-first (`parseVersion`,
  `resolveRange`)

### Pipe vs Generator Style

Both are idiomatic. Use generators (`Effect.gen`) for sequential,
imperative-looking code. Use pipe for composition and transformation
chains:

```typescript
// Generator style (good for sequential operations)
const program = Effect.gen(function* () {
  const parser = yield* SemVerParser
  const version = yield* parser.parseVersion(input)
  return version
})

// Pipe style (good for transformations)
const program = SemVerParser.pipe(
  Effect.andThen((parser) => parser.parseVersion(input)),
  Effect.map((version) => version.major)
)
```

**Recommendation:** Use generators for service method implementations
(clearer control flow) and pipes for one-liners and transformations.

### Readonly Everything

Effect is immutable-first. Use `readonly` on all fields:

```typescript
interface VersionCache {
  readonly load: (versions: ReadonlyArray<SemVer>) => Effect.Effect<void>
  readonly add: (version: SemVer) => Effect.Effect<void>
  readonly resolve: (range: Range) => Effect.Effect<SemVer, UnsatisfiedRangeError>
}
```

---

## 8. Concerns and Suggestions

### Concern 1: Schema.NonNegativeInt Branding

`Schema.NonNegativeInt` applies a **brand** to the type, meaning the
TypeScript type becomes `number & Brand<"NonNegativeInt">` rather than
plain `number`. This affects the API surface:

- Consumers constructing SemVer instances programmatically would need to
  cast or use the schema decoder to produce branded values
- Internal code like the parser can use `{ disableValidation: true }` to
  bypass this

**Suggestion:** Consider whether `Schema.NonNegative.pipe(Schema.int())`
or a custom filter on `Schema.Number` might produce a cleaner developer
experience. Alternatively, accept the brand and document that consumers
should use `new SemVer(...)` (which validates) or the parser.

Alternatively, use `Schema.Int` with a filter for `>= 0` to keep the
`number` type unbranded while still validating at construction:

```typescript
const NonNegInt = Schema.Int.pipe(Schema.filter((n) => n >= 0))
```

This produces `number` at the type level (no brand), while still
rejecting negative or non-integer values at decode/construction time.

### Concern 2: Array Equality in Schema.TaggedClass

The default `Data.Class` equality for arrays is **shallow reference
comparison**. This means two SemVer instances created separately with
identical `prerelease: ["alpha", 1]` may NOT be equal under the default
implementation, because the two array instances are different references.

**This is why overriding `[Equal.symbol]` is essential.** Without the
override, the following would fail:

```typescript
const a = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["alpha", 1], build: [] })
const b = new SemVer({ major: 1, minor: 0, patch: 0, prerelease: ["alpha", 1], build: [] })
Equal.equals(a, b) // might be false without custom Equal!
```

**Mitigation:** The custom `[Equal.symbol]` override described in
Section 1 handles this correctly by comparing arrays element-by-element.

### Concern 3: SortedSet Deduplication and Build Metadata

Since our custom Equal ignores build metadata, `SortedSet` will treat
`1.0.0+build1` and `1.0.0+build2` as the same element. When adding
`1.0.0+build2` to a set that already contains `1.0.0+build1`, the
behavior depends on SortedSet's implementation -- it may keep the
original or replace it.

**Suggestion:** Document this behavior and decide on a policy. If the
"first wins" behavior is acceptable, no action needed. If "latest wins"
is desired, use `Ref.update` with a remove-then-add pattern.

### Concern 4: SemVerParser as a Stateless Service

The parser is stateless -- it has no configuration or mutable state. Using
a service for it adds a dependency requirement (`R = SemVerParser`) to
every Effect that uses parsing. This is boilerplate for consumers.

**Suggestion:** Consider also exporting the parser functions directly
(not behind a service) for simple use cases. The service can exist for
dependency injection and testability, while the direct functions serve
users who just want to parse a version string:

```typescript
// Service-based (for DI and testability)
const version = yield* SemVerParser.pipe(
  Effect.andThen((p) => p.parseVersion("1.2.3"))
)

// Direct function (for convenience)
import { parseVersion } from "semver-effect"
const version = yield* parseVersion("1.2.3")
```

This is a common pattern in the Effect ecosystem -- provide both a
service and convenience functions.

### Concern 5: resolveString Dependency Leaking

The `resolveString` method on VersionCache needs `SemVerParser` to parse
the range string. The design docs show it in the VersionCache interface.
If implemented naively, this creates a hidden dependency:

```typescript
// In VersionCacheLive, resolveString needs SemVerParser
resolveString: (input) => Effect.gen(function* () {
  const parser = yield* SemVerParser  // This leaks into the R channel!
  const range = yield* parser.parseRange(input)
  return yield* resolve(range)
})
```

**Better approach:** Capture SemVerParser at Layer construction time:

```typescript
export const VersionCacheLive = Layer.effect(
  VersionCache,
  Effect.gen(function* () {
    const parser = yield* SemVerParser  // Captured at construction
    const ref = yield* Ref.make(SortedSet.empty(SemVerOrder))
    return {
      resolveString: (input) => Effect.gen(function* () {
        const range = yield* parser.parseRange(input)
        return yield* resolve(range)  // resolve closes over ref
      }),
      // ...
    }
  })
)
// Type: Layer<VersionCache, never, SemVerParser>
```

This makes the Layer's input requirements explicit
(`RequirementsIn = SemVerParser`) while keeping the service method
signatures clean (`Effect<SemVer, E, never>`).

### Concern 6: Inspectable Implementation

For Inspectable (used by `console.log`, Effect's debug output, etc.),
implement `toJSON()` and/or `toString()` on the class:

```typescript
class SemVer extends Schema.TaggedClass<SemVer>()("SemVer", { ... }) {
  toString(): string {
    let s = `${this.major}.${this.minor}.${this.patch}`
    if (this.prerelease.length > 0) s += `-${this.prerelease.join(".")}`
    if (this.build.length > 0) s += `+${this.build.join(".")}`
    return s
  }

  toJSON(): unknown {
    return {
      _tag: "SemVer",
      major: this.major,
      minor: this.minor,
      patch: this.patch,
      prerelease: this.prerelease,
      build: this.build,
    }
  }

  // For Node.js util.inspect
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `SemVer(${this.toString()})`
  }
}
```

### Suggestion: Consider Effect.Tag (Newer API)

In more recent Effect versions, `Effect.Tag` has been introduced as yet
another way to define services. Check if the version of Effect you adopt
supports it. `Effect.Tag` combines the tag and a default implementation:

```typescript
class SemVerParser extends Effect.Tag("SemVerParser")<
  SemVerParser,
  SemVerParserShape
>() {
  static Live = Layer.succeed(this, { ... })
}
```

This may or may not have the same api-extractor issues. Worth testing
before committing to `GenericTag`.

---

## Summary of Recommendations

| Topic | Recommendation |
| :-- | :-- |
| Schema.TaggedClass | Use as planned; override Equal/Hash to ignore build metadata |
| Array equality | Must override Equal.symbol -- default shallow comparison will fail |
| Schema.NonNegativeInt | Consider unbranded alternative to avoid brand leaking |
| Context.GenericTag | Keep if api-extractor is required; functionally equivalent to class Tag |
| Data.TaggedError | Split base pattern is correct for api-extractor |
| Ref + SortedSet | Good choice; use plain Ref (not SynchronizedRef) |
| Order | Use Order.make with full spec clause 11 implementation |
| Layer.succeed vs Layer.effect | Use Layer.succeed for parser, Layer.effect for cache |
| Testing | Use Effect.either + runPromise for clean error assertions |
| Vitest pool | Use forks pool for Effect compatibility |
| Direct parse functions | Consider exporting alongside service for convenience |
| resolveString | Capture SemVerParser at Layer construction, not in method body |
| disableValidation | Use in parser internals for performance |
