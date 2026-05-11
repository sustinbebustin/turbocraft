# Build and bundling

How the published `turbocraft` package becomes a self-contained CLI from a
three-package workspace.

## Tools

- **tsdown** (oxc-based) bundles every package's TypeScript into an ESM
  `dist/`. Per-package configs at `<pkg>/tsdown.config.ts`.
- **turbo** orchestrates `build` across packages with `dependsOn: ["^build"]`
  so workspace deps build before their dependents.
- A small Node script — [`apps/cli/scripts/copy-templates.mjs`](../../apps/cli/scripts/copy-templates.mjs)
  — runs at the end of `apps/cli`'s build to mirror
  `packages/templates/src/` into `apps/cli/templates/`.

## What gets inlined into the published CLI

`apps/cli` declares its truly-external runtime deps in
`tsdown.config.ts`'s `deps.neverBundle`:

```ts
deps: {
  neverBundle: [
    "node-plop", "@clack/prompts", "citty",
    "effect", "@effect/platform", "@effect/platform-node",
    "handlebars", "picocolors", "tinyexec", "tinyglobby", "zod",
  ],
},
```

Everything else is inlined into `dist/bin.mjs`. The key consequence:
`@turbocraft/core` and `@turbocraft/templates` are **inlined** at build
time, not referenced as runtime dependencies.

To make this work, those workspace packages live in `apps/cli`'s
`devDependencies`, not `dependencies`. tsdown's default behaviour is to
externalise anything in `dependencies` regardless of `neverBundle`, so a
workspace package in `dependencies` would survive into the published
bundle as `import "@turbocraft/core"` and break on install (since no such
package exists on npm).

The shape of `apps/cli/package.json`:

```jsonc
{
  "dependencies": {           // all external, all real npm packages
    "@clack/prompts": "...",
    "@effect/platform": "...",
    "citty": "...",
    "effect": "...",
    "handlebars": "...",
    "node-plop": "...",
    "picocolors": "...",
    "tinyexec": "...",
    "tinyglobby": "...",
    "zod": "..."
  },
  "devDependencies": {        // inlined or build-time only
    "@turbocraft/core": "workspace:*",
    "@turbocraft/templates": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "tsdown": "...",
    "typescript": "...",
    "vitest": "..."
  }
}
```

After `pnpm publish`, the workspace `workspace:*` specifiers are rewritten
by pnpm. Internal devDependencies survive into the published `package.json`
at their workspace version (`0.0.0`), but **npm never installs devDeps for
consumers** — they're inert.

## Publish layout

The `turbocraft` tarball whitelist (`files`):

```json
"files": ["dist", "templates"]
```

Inside the tarball:

```text
package/
  dist/
    bin.mjs              # bundled CLI (includes core + templates code)
    bin.mjs.map
  templates/             # mirrored from packages/templates/src/ at build
    shared/...
    frameworks/...
    features/...
    variants/...
  package.json
  README.md
```

Total: ~370 files, dominated by the template assets. `bin.mjs` itself is
~32 KB.

The `bin` field maps `turbocraft` -> `./dist/bin.mjs`, and the build script
chmods it executable (`tsdown` does this for any output starting with a
shebang).

## Templates resolution

At runtime, `@turbocraft/templates`'s `templatesRoot()` decides where to
read template assets from. Resolution order:

1. Explicit override via `setTemplatesRoot(path)`.
2. `TURBOCRAFT_TEMPLATES_ROOT` env var.
3. If `import.meta.url` ends in `/src`, return that (source mode — vitest
   or tsx).
4. Otherwise `../src` relative to the importing module (workspace build).

The published CLI's `TemplatesLive` service overrides this by calling
`setTemplatesRoot(<dist-sibling>/templates)` at module load — because in
the published layout the assets live in `apps/cli/templates/`, not in the
templates package (which isn't published at all). See
[CLI internals](cli-internals.md#templatesservice--the-bundled-root-trick).

## The `create-turbocraft` shim

`apps/create-turbocraft/` is a tiny separate package — bin entry point that
re-execs `turbocraft create`. It exists because npm's `create-*`
convention dictates the package name:

```bash
npm create turbocraft@latest my-app    # resolves to `create-turbocraft`
pnpm create turbocraft my-app           # same
```

The shim is published alongside `turbocraft` in a fixed-version group via
changesets — they bump together.

## Build commands

| Command            | What it does                                                 |
|--------------------|--------------------------------------------------------------|
| `pnpm build`       | turbo build for the whole workspace.                         |
| `pnpm dev`         | turbo dev (watch mode in every package).                     |
| `pnpm typecheck`   | `effect-language-service patch && tsc --noEmit` per package. |
| `pnpm test`        | vitest across all packages.                                  |
| `pnpm lint`        | oxlint at the repo root.                                     |
| `pnpm format`      | oxfmt at the repo root (`--disable-nested-config`).          |

The `--disable-nested-config` flag matters because template assets ship
their own `.oxfmtrc.json` files (destined for scaffolded projects). Without
the flag, oxfmt would descend into them and apply *those* rules to the
template source.

## CI verification

The release workflow ([`.github/workflows/release.yml`](../../.github/workflows/release.yml))
runs `pnpm typecheck`, `pnpm test`, and `pnpm build --filter=turbocraft
--filter=create-turbocraft` before letting changesets publish. CI
([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) runs the
same checks on every push and PR.
