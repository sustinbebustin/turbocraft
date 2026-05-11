# CLAUDE.md - turbocraft

This is the monorepo that builds the `turbocraft` CLI.

## What it does

`turbocraft` scaffolds one of four template variants (Next.js / TanStack Start,
monorepo / single-app) on demand by composing **layers** of template fragments
under `packages/templates/src/`.

### Layer model

A variant is a `TemplateManifest` (`packages/templates/src/variants/<id>.ts`)
that declares an ordered list of `layers` plus per-feature `featureLayers`.
Each layer is a `{ from, to }` pair: `from` is a path relative to the
templates root, `to` is a destination inside the generated project.

At scaffold time the engine walks every layer in order. For each file:

- `*.hbs` -> rendered with Handlebars (`projectName`, `withConvex`,
  `withBetterAuth`) and written without the `.hbs` suffix.
- `*.merge.json` -> deep-merged into an accumulator keyed by destination
  (used to compose `package.json` from multiple sources).
- everything else -> copied verbatim (later layer wins on conflicts).

After all layers are applied, the merge accumulator is flushed: each merged
JSON value is deep-merged into the existing file at that destination (if any)
and written out.

### Directory shape

```
packages/templates/src/
|-- shared/
|   |-- base/                  shared between all single-app variants
|   `-- monorepo/              shared between all monorepo variants (ui pkg, etc.)
|-- frameworks/
|   |-- nextjs/
|   |   |-- app/               single-app Next.js source
|   |   |-- monorepo/          monorepo Next.js source (apps/web + framework root)
|   |   |-- oxlint/            framework-specific oxlint patches
|   |   `-- generators/        Plop generators (copied to <output>/turbo/generators)
|   `-- tanstack/              same shape
|-- features/
|   |-- convex/
|   |   |-- compatibility.ts   { requires: Feature[] }
|   |   |-- files/             always-at-root (convex/ schema dir)
|   |   |-- deps/{single,monorepo}/package.json.merge.json
|   |   |-- nextjs/files/      Next.js-specific feature files
|   |   `-- tanstack/{files,deps}/
|   `-- better-auth/           same shape
`-- variants/
    |-- nextjs-{single,monorepo}.ts
    `-- tanstack-{single,monorepo}.ts
```

### Adding a new framework

Drop in `frameworks/<name>/{app,monorepo,generators}/` plus
`variants/<name>-{single,monorepo}.ts` composing existing shared layers with
the new framework layers. No edits to other variants or to the scaffolder.

### Adding a new feature

Drop in `features/<name>/{files,compatibility.ts,deps/...}/` and reference it
under `featureLayers` in the variants that should support it. The wizard
auto-discovers the new feature via `loadCompatibility()`; the
`compatibility.requires` field gates inter-feature dependencies declaratively.

### Plop generators

The Plop generators under `frameworks/<fw>/generators/` are copied verbatim
into `<output>/turbo/generators/` so the same templates drive `turbo gen run`
post-scaffold. `initialGenerators` is empty for every variant - the initial
project is materialised entirely by layers.

## Local commands

- `pnpm build` - bundle the CLI via tsdown (oxc)
- `pnpm dev` - watch mode (turbo runs each package's `dev` task)
- `pnpm test` - vitest across all packages
- `pnpm typecheck` - `effect-language-service patch && tsc --noEmit`
- `pnpm lint` / `pnpm format` - oxlint + oxfmt

## Key invariants

1. Monorepo variants use `catalog:` refs that resolve against each variant's
   `pnpm-workspace.yaml` (in `frameworks/<fw>/monorepo/`). Single-app variants
   use full version pins in their `package.json.hbs`. Feature deps follow the
   same split via `features/<feat>/deps/{single,monorepo}/`.
2. Templates in `packages/templates/src/**` are **not type-checked or linted**
   here - they are output-time assets. The root `.oxlintrc.json` and the
   root `.oxfmtrc.json`'s `ignorePatterns` exclude them; the `format` script
   passes `--disable-nested-config` so oxfmt doesn't walk into template
   asset `.oxfmtrc.json` files (which ship to scaffolded projects).
3. Inter-feature dependencies are declared per-feature in
   `features/<feat>/compatibility.ts` (e.g. better-auth requires convex). The
   wizard reads `loadCompatibility()` rather than hard-coding rules.
4. Two variants diverging on the same asset is a smell. If the asset is
   cross-framework, hoist into `shared/`; if cross-layout, hoist into the
   framework dir; otherwise restrict to a single variant.

## Effect best practices

Always consult `effect-solutions` before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Never guess at Effect patterns - check the guide first.
