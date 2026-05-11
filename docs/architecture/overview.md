# Architecture overview

`turbocraft` is itself a Turborepo monorepo. This document explains the
package boundaries, what's published, and the data flow at a high level.

## Repo layout

```text
turbocraft/
  apps/
    cli/                 The published `turbocraft` npm package.
    create-turbocraft/   Tiny shim that forwards to `turbocraft create`
                         (so `npm create turbocraft@latest` works).
  packages/
    core/                @turbocraft/core — schemas, types, manifest
                         contracts, error types, runner contract.
    templates/           @turbocraft/templates — template assets, variant
                         manifests, feature compatibility metadata.
    typescript-config/   @workspace/typescript-config — shared tsconfig
                         bases consumed by every other package.
  docs/                  This directory.
  .changeset/            Changeset entries + release config.
  .github/workflows/     ci.yml, release.yml.
```

## Package boundaries

```text
                                  +---------------------+
                                  |  apps/cli           |
                                  |  (`turbocraft`)     |
                                  +----------+----------+
                                             |
                                             | depends on (inlined at build)
                                             v
                              +--------------+--------------+
                              |   @turbocraft/templates     |
                              +--------------+--------------+
                                             |
                                             v
                              +--------------+--------------+
                              |     @turbocraft/core        |
                              +-----------------------------+
```

- `@turbocraft/core` is the dependency-free contract layer: Zod schemas
  for `Framework`, `Layout`, `Feature`, `ProjectConfig`; the
  `TemplateManifest` and `FeatureCompatibility` types; error tags; the
  `GeneratorRunner` contract.
- `@turbocraft/templates` is *only* assets + manifest data. It imports
  types from core and exports the variant registry plus the
  `templatesRoot()` resolver.
- `apps/cli` is the user-facing entrypoint. It composes Effect services
  (FileSystem, PackageManager, Plop, Process, Templates), drives the
  wizard, and orchestrates the scaffold pipeline.

## What's published

Only **two** packages ship to npm:

| Package             | Purpose                                                     |
|---------------------|-------------------------------------------------------------|
| `turbocraft`        | The CLI. Self-contained — workspace deps are inlined.       |
| `create-turbocraft` | npm-`create` shim that re-execs `turbocraft create`.        |

`@turbocraft/core`, `@turbocraft/templates`, and
`@workspace/typescript-config` are **private workspaces**: their code is
inlined into the `turbocraft` bundle at build time. Consumers see a
self-contained CLI with no internal workspace refs in its `dependencies`.

See [Build and bundling](build-and-bundling.md) for the mechanics.

## Data flow at a glance

```text
   user invokes `turbocraft create my-app`
                  |
                  v
   argv normalisation (apps/cli/src/main.ts)
                  |
                  v
   citty parses + validates flags via Zod schemas
                  |
                  v
   runWizard()  — fills missing answers interactively
                  |
                  v
   scaffold():
     1. resolve variant manifest from @turbocraft/templates
     2. ensure target dir empty (or --force)
     3. seedTarget — walk layers, render .hbs, deep-merge .merge.json
     4. runInitialGenerators — Plop (empty for current variants)
     5. initGit
     6. installDeps (pnpm/npm/bun)
                  |
                  v
   ScaffoldReport printed via @clack/prompts outro
```

Each phase is its own module under
[`apps/cli/src/operations/`](../../apps/cli/src/operations/). See
[Scaffold pipeline](scaffold-pipeline.md) for a deeper walk.

## Key invariants

1. **Templates are runtime assets, not source code.** Files under
   `packages/templates/src/**` are never type-checked or linted by the
   monorepo's tooling. They ship as-is into generated projects.
2. **Monorepo template variants use `catalog:` refs**; single-app variants
   use full version pins. Feature deps split the same way under
   `features/<id>/deps/{single,monorepo}/`.
3. **Inter-feature dependencies are declarative**, sourced from each
   feature's `compatibility.ts`. The wizard reads
   `loadCompatibility()` rather than hard-coding rules.
4. **Two variants diverging on the same asset is a smell.** If the asset
   is cross-framework, hoist it into `shared/`; if cross-layout, hoist
   into the framework dir; otherwise scope to a single variant.

## Where to go next

- [Scaffold pipeline](scaffold-pipeline.md) — execution model.
- [Templates system](templates-system.md) — layer composition.
- [CLI internals](cli-internals.md) — Effect services and command wiring.
- [Build and bundling](build-and-bundling.md) — publish layout.
