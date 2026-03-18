---
"semver-effect": minor
---

## Breaking Changes

- **Schema.TaggedClass**: SemVer, Comparator, Range, VersionDiff now use
  `Schema.TaggedClass` instead of `Data.TaggedClass` with split base pattern.
  No more `*Base` exports for schemas.
- **Class-based Context.Tag**: Services (SemVerParser, VersionCache,
  VersionFetcher) migrated from `Context.GenericTag` to class-based
  `Context.Tag` with fully-qualified identifiers.
- **Flat exports**: Namespace modules removed. All exports are flat from
  `index.ts`. Standalone dual-API functions remain for pipe composition.

## Features

- **Instance methods**: SemVer has `compare()`, `gt()`, `gte()`, `lt()`,
  `lte()`, `eq()`, `neq()`, `isPrerelease`, `isStable`, and `bump.major()` /
  `bump.minor()` / `bump.patch()` / `bump.prerelease()` / `bump.release()`.
  Range has `test()` and `filter()`. Comparator has `test()`.
- **Static methods**: `SemVer.parse()`, `Range.parse()`, `Comparator.parse()`
  plus dual-API statics like `SemVer.compare()`, `Range.satisfies()`, etc.

## Other

- Clean build output: no `rslib-runtime.js` in dist.
- Closes #24
