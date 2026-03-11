---
"semver-effect": minor
---

## Features

Initial release of semver-effect: a strict SemVer 2.0.0 implementation built on Effect.

- **Core types** — `SemVer`, `Comparator`, `Range`, and `VersionDiff` as immutable Data.TaggedClass instances with structural equality.
- **Parsing** — Hand-written recursive descent parser for versions and ranges. Supports caret, tilde, hyphen, and X-range syntax. All operations return typed errors through Effect's error channel.
- **Comparison** — Full suite of comparison functions (`compare`, `equal`, `gt`, `gte`, `lt`, `lte`, `neq`, `max`, `min`, `sort`, `rsort`) following SemVer 2.0.0 precedence rules.
- **Bumping** — Version bump utilities (`bumpMajor`, `bumpMinor`, `bumpPatch`, `bumpPrerelease`, `bumpRelease`).
- **Range matching** — `satisfies`, `filter`, `maxSatisfying`, `minSatisfying` for testing versions against ranges.
- **Range algebra** — `intersect`, `union`, `isSubset`, `equivalent`, `simplify` for composing and analyzing ranges.
- **Services** — `SemVerParser`, `VersionCache`, and `VersionFetcher` Effect services with live layer implementations for dependency injection.
- **Strict compliance** — Only SemVer 2.0.0 is supported. No loose parsing, no v-prefix coercion, no node-semver compatibility hacks.
