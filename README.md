# bun-optional-platform-probe

Mend SCA detection probe targeting platform-conditional `optionalDependencies` in Bun projects.

## Pattern

`optional-platform-deps`

## Why standalone

This probe is kept standalone from the generic `optionalDependencies` group exercised in probe #2 (`bun-dep-types-probe`). The distinction matters because generic optional deps (e.g. `fsevents` — a macOS-only file-watcher) test a single non-matching platform dependency, while platform-conditional binary subpackages (e.g. the `@esbuild/*` family) test a multi-variant resolution pattern where:

1. The root manifest explicitly lists N platform variants in `optionalDependencies`.
2. The direct dep (`esbuild`) also lists all N variants in its own `optionalDependencies` — so variants are reachable via BOTH the root manifest and the transitive dep graph.
3. At install time Bun downloads only the one variant matching the host OS/CPU. All others remain in the lockfile as resolved-but-skipped entries.
4. At scan time the UA's npm-fallback parser must read the `bun.lock` statically and emit all N variants without applying host-OS filtering.

This "all variants in lockfile, only one installed" code path is where Mend's npm-resolver fallback most commonly drops entries — it may mimic npm's install-time behaviour (skip non-matching optional deps) rather than treating the lockfile as a static manifest of all resolved packages.

Bundling this pattern with probe #2 would obscure whether a failure is caused by generic optional-dep handling (single dep, no os/cpu metadata) or by platform-variant filtering (multiple deps, explicit os/cpu metadata in lockfile entries). Keeping them separate makes failures localise cleanly.

## Mend config

No `.whitesource` file is emitted. Bun is NOT in the Mend `install-tool` supported list — `scanSettings.versioning` cannot pin a Bun toolchain version. Detection relies entirely on static lockfile parsing of `bun.lock`. There is no UA pre-step for Bun.

Reference: `plugins/mend-knowledge/skills/mend-sca/references/whitesource-config.md` — Bun is flagged as "NOT in install-tool list — flag as limitation".

## Package inventory

| Package | Manifest field | Resolved version | Expected `group` | `optional` |
|---|---|---|---|---|
| `esbuild` | `dependencies` | `0.19.12` | `main` | `false` |
| `@esbuild/linux-x64` | `optionalDependencies` | `0.19.12` | `main` | `true` |
| `@esbuild/darwin-arm64` | `optionalDependencies` | `0.19.12` | `main` | `true` |
| `@esbuild/darwin-x64` | `optionalDependencies` | `0.19.12` | `main` | `true` |
| `@esbuild/win32-x64` | `optionalDependencies` | `0.19.12` | `main` | `true` |

## Platform variant matrix

| Variant | Expected `os` | Expected `cpu` | Expected `optional: true` |
|---|---|---|---|
| `@esbuild/linux-x64` | `linux` | `x64` | yes |
| `@esbuild/darwin-arm64` | `darwin` | `arm64` | yes |
| `@esbuild/darwin-x64` | `darwin` | `x64` | yes |
| `@esbuild/win32-x64` | `win32` | `x64` | yes |

Note: `esbuild@0.19.12`'s registry `package.json` lists 22 platform variants in its own `optionalDependencies`. This probe exercises only the 4 variants explicitly declared in the root `optionalDependencies`. The other 18 (e.g. `@esbuild/linux-arm64`, `@esbuild/android-arm`, etc.) are recorded in the lockfile only as children of `esbuild` — they are NOT root-level optionals in this probe. The comparator should check only the 5 packages above; if Mend also emits additional variants that were resolved transitively, that is not an error.

## Failure modes

| Failure | Root cause | Symptom |
|---|---|---|
| Only the scan-host variant detected | UA applies install-time platform filtering at parse time | 3 variants missing from tree |
| All four platform variants missing | All optional deps excluded from scan | 4 variants missing; `esbuild` itself still present |
| `optional: true` flag dropped on platform variants | Lockfile optional metadata not propagated to output | All four variants present but flagged `optional: false` |
| `os`/`cpu` metadata not preserved | Lockfile entry metadata stripped before emitting | Variants present and flagged correctly but `source_detail.marker` empty |
| Scoped name mangled | `@esbuild/` prefix stripped by manifest parser | ArtifactId reported as `darwin-arm64` instead of `@esbuild/darwin-arm64` |
| Empty tree or parse error | JSONC comments/trailing commas in `bun.lock` crash the npm-fallback parser | Zero deps in output |

## Resolver note

Bun is not listed in the UA JavaScript resolver table. The UA will attempt to parse `bun.lock` via the npm-resolver fallback (`NpmLockCollector`). This resolver was designed for `package-lock.json` and `npm-shrinkwrap.json`, both of which are strict JSON. Key divergences from `bun.lock`:

- `bun.lock` is JSONC — comments (`//`) and trailing commas are valid syntax. Standard `JSON.parse()` will throw.
- Bun's package entry tuple `["name@version", { metadata }, "integrity"]` is structurally different from npm's nested `dependencies` object.
- Platform variants in `bun.lock` carry `os` and `cpu` fields in the metadata object. npm's lockfile format stores equivalent information differently.
- Because there is no install step for Bun scans, the UA cannot run `bun install --frozen-lockfile` to materialise `node_modules` and then inspect what was installed. It must treat the lockfile as the authoritative resolved graph.

This probe is not listed in the UA resolver knowledge for JavaScript (`javascript.md`) — Bun support is exploratory. The `expected-tree.json::warnings[]` section documents what Mend WILL emit if platform filtering is incorrectly applied (the wrong tree), so the downstream comparator can flag it as a false negative rather than an unexpected pass.

## Probe metadata

- Schema version: `1.0`
- PM: `bun`
- PM version tested: `1.2.0`
- Lockfile format: text JSONC (`bun.lock`)
- Catalog pattern: `optional-platform-deps`
- Coverage plan entry: Tier 2, entry #8

## Tracked in

`docs/BUN_COVERAGE_PLAN.md` §11.2 entry #8
