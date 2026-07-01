---
"semver-effect": minor
---

## Documentation

TSDoc comments across `errors/`, `schemas/`, `services/`, `layers/`, and `utils/` now conform to the API Extractor toolchain (proper release tags, resolved `tsdoc-*` warnings). No runtime behavior changes.

## Build System

* Migrated `savvy.build.ts` to the `@savvy-web/bundler@^1.1.0` `build()` API, replacing the previous `defineBuild` / `runBuild` pair
* Added a sanctioned `ae-forgotten-export` suppression (matching the `_base` pattern) for the synthetic intermediate classes Effect's `Context.Tag` generates, which cannot themselves be exported or release-tagged
* The production build now completes with 0 API Extractor warnings and 0 errors
