# Building a Document Version System

This walkthrough builds a small but realistic application: a **versioned
document store** that tracks file revisions using semantic versioning, enforces
save-on-change semantics, and supports range queries over version history. It
combines several semver-effect features with core Effect patterns to show how
they compose in practice.

## Data Model

Every document revision is an immutable record that carries its filename,
content, version, and a timestamp:

```typescript
import { Context, Data, Effect, HashMap, Layer, Ref, Array as Arr } from "effect";
import { SemVer, Range, type InvalidRangeError } from "semver-effect";

class VersionedDocument extends Data.TaggedClass("VersionedDocument")<{
  readonly filename: string;
  readonly content: string;
  readonly version: SemVer.SemVer;
  readonly savedAt: Date;
}> {}

class DocumentNotFoundError extends Data.TaggedError("DocumentNotFoundError")<{
  readonly filename: string;
}> {}

class NoChangesError extends Data.TaggedError("NoChangesError")<{
  readonly filename: string;
  readonly version: SemVer.SemVer;
}> {}
```

`VersionedDocument` uses `Data.TaggedClass`, which gives it structural equality
and hashing for free. Notice that `SemVer.SemVer` is used directly as a field
type — it composes naturally because it is also a `TaggedClass`. The two error
types follow the same split-base pattern: `DocumentNotFoundError` for missing
files and `NoChangesError` when a save is attempted with identical content.

## Service Interface

The store exposes five operations. The return types encode exactly which errors
each operation can produce:

```typescript
interface DocumentStore {
  readonly create: (filename: string, content: string) => Effect.Effect<VersionedDocument>;
  readonly save: (
    filename: string,
    content: string,
  ) => Effect.Effect<VersionedDocument, DocumentNotFoundError | NoChangesError>;
  readonly get: (filename: string) => Effect.Effect<VersionedDocument, DocumentNotFoundError>;
  readonly history: (
    filename: string,
  ) => Effect.Effect<ReadonlyArray<VersionedDocument>, DocumentNotFoundError>;
  readonly findByRange: (
    filename: string,
    range: string,
  ) => Effect.Effect<ReadonlyArray<VersionedDocument>, DocumentNotFoundError | InvalidRangeError>;
}

const DocumentStore = Context.GenericTag<DocumentStore>("DocumentStore");
```

`create` is infallible — it always succeeds. `save` can fail if the file does
not exist or if nothing changed. `findByRange` can additionally fail with
`InvalidRangeError` when the user provides a malformed range string. This
type-level precision is one of Effect's key strengths.

## Layer Implementation

The live implementation uses a `Ref<HashMap>` for in-memory state. Each
filename maps to an array of document revisions:

```typescript
const DocumentStoreLive = Layer.effect(
  DocumentStore,
  Effect.gen(function* () {
    const store = yield* Ref.make(
      HashMap.empty<string, ReadonlyArray<VersionedDocument>>(),
    );

    const getHistory = (filename: string) =>
      Ref.get(store).pipe(
        Effect.map(HashMap.get(filename)),
        Effect.flatten,
        Effect.mapError(() => new DocumentNotFoundError({ filename })),
      );

    return DocumentStore.of({
      create: (filename, content) =>
        Effect.gen(function* () {
          const doc = new VersionedDocument({
            filename,
            content,
            version: SemVer.make(0, 1, 0),
            savedAt: new Date(),
          });
          yield* Ref.update(store, HashMap.set(filename, [doc]));
          return doc;
        }),

      save: (filename, content) =>
        Effect.gen(function* () {
          const docs = yield* getHistory(filename);
          const sorted = Arr.sort(docs, {
            compare: (a, b) => SemVer.Order(a.version, b.version),
          });
          const latest = sorted[sorted.length - 1]!;

          if (latest.content === content) {
            return yield* Effect.fail(
              new NoChangesError({ filename, version: latest.version }),
            );
          }

          const doc = new VersionedDocument({
            filename,
            content,
            version: SemVer.bump.minor(latest.version),
            savedAt: new Date(),
          });
          yield* Ref.update(store, HashMap.set(filename, [...docs, doc]));
          return doc;
        }),

      get: (filename) =>
        Effect.gen(function* () {
          const docs = yield* getHistory(filename);
          const sorted = Arr.sort(docs, {
            compare: (a, b) => SemVer.Order(a.version, b.version),
          });
          return sorted[sorted.length - 1]!;
        }),

      history: (filename) =>
        Effect.gen(function* () {
          const docs = yield* getHistory(filename);
          return Arr.sort(docs, {
            compare: (a, b) => SemVer.Order(a.version, b.version),
          });
        }),

      findByRange: (filename, rangeStr) =>
        Effect.gen(function* () {
          const docs = yield* getHistory(filename);
          const range = yield* Range.fromString(rangeStr);
          return docs.filter((d) => Range.satisfies(d.version, range));
        }),
    });
  }),
);
```

A few things worth noting:

- **`SemVer.make(0, 1, 0)`** creates the initial version for every new
  document. No parsing needed — just pass major, minor, patch.
- **`SemVer.bump.minor`** increments the minor version of the latest revision.
  Because `SemVer` is immutable, this returns a new value.
- **`SemVer.Order`** is a standard Effect `Order` instance, so it plugs
  directly into `Arr.sort` for chronological sorting.
- **`Range.fromString`** parses the user-supplied range string and fails with
  `InvalidRangeError` if it is malformed. The error propagates automatically
  through the Effect channel.
- **`Range.satisfies`** tests whether a version falls within the parsed range.

## Usage

Putting it all together in a program:

```typescript
const program = Effect.gen(function* () {
  const docs = yield* DocumentStore;

  // Create a new document
  const readme = yield* docs.create("README.md", "# Hello");
  console.log(readme.version.toString()); // "0.1.0"

  // Save with changes — version bumps automatically
  const v2 = yield* docs.save("README.md", "# Hello World");
  console.log(v2.version.toString()); // "0.2.0"

  // Try saving without changes — handled gracefully
  const result = yield* docs.save("README.md", "# Hello World").pipe(
    Effect.catchTag("NoChangesError", (e) =>
      Effect.succeed(`No changes to ${e.filename} at ${e.version}`),
    ),
  );
  console.log(result); // "No changes to README.md at 0.2.0"

  // Save again with new content
  const v3 = yield* docs.save("README.md", "# Hello World\n\nUpdated content.");
  console.log(v3.version.toString()); // "0.3.0"

  // Query: which versions match ^0.1.0?
  const matches = yield* docs.findByRange("README.md", "^0.1.0");
  console.log(matches.map((d) => d.version.toString()));
  // ["0.1.0", "0.2.0", "0.3.0"]

  // Compare versions with diff
  const allVersions = yield* docs.history("README.md");
  const oldest = allVersions[0]!;
  const newest = allVersions[allVersions.length - 1]!;
  const d = SemVer.diff(oldest.version, newest.version);
  console.log(d.type);       // "minor"
  console.log(d.minor);      // 2
  console.log(d.toString()); // "minor (0.1.0 → 0.3.0)"
});

Effect.runSync(program.pipe(Effect.provide(DocumentStoreLive)));
```

The program reads top-to-bottom like synchronous code, but every step is a
properly typed Effect. Errors are tracked in the type system and handled with
`Effect.catchTag` — the `"NoChangesError"` string is checked at compile time.

## What We Used

| Feature | Usage |
| --- | --- |
| `SemVer.make` | Initialize document at `0.1.0` |
| `SemVer.bump.minor` | Auto-increment version on save |
| `SemVer.Order` | Sort version history |
| `SemVer.diff` | Compare oldest and newest versions |
| `Range.fromString` | Parse user-provided range queries |
| `Range.satisfies` | Filter documents by version range |
| `Data.TaggedClass` | Immutable document type with equality |
| `Data.TaggedError` | Typed errors for missing docs and no-changes |
| `Context.GenericTag` | Service definition |
| `Layer.effect` | Service implementation with state |
| `Ref` + `HashMap` | In-memory versioned document store |
| `Effect.catchTag` | Graceful error recovery |
