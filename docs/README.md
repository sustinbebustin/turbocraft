# turbocraft docs

Repo-internal documentation for the `turbocraft` CLI and its monorepo. These
files are not shipped with the published npm package — they live here for
contributors and for users who want a deeper reference than the root
`README.md` provides.

## If you want to *use* the CLI

Start here:

- [Getting started](guides/getting-started.md) — install, scaffold your first
  project, pick a variant.
- [CLI reference](guides/cli-reference.md) — every command, flag, and env var.
- [Variants and features](guides/variants.md) — the four templates, what
  ships in each, and the feature compatibility matrix.
- [Troubleshooting](guides/troubleshooting.md) — common errors, `doctor`,
  Node and package-manager requirements.

## If you want to *understand* the repo

- [Architecture overview](architecture/overview.md) — monorepo layout,
  package boundaries, what's published vs internal.
- [Scaffold pipeline](architecture/scaffold-pipeline.md) — what happens
  end-to-end when a user runs `turbocraft create`.
- [Templates system](architecture/templates-system.md) — the layer model,
  `.hbs` / `.merge.json` semantics, manifests.
- [CLI internals](architecture/cli-internals.md) — Effect services, citty
  command wiring, the wizard flow.
- [Build and bundling](architecture/build-and-bundling.md) — `tsdown` config,
  what gets inlined into the published bundle, the templates-resolution
  trick.

## If you want to *contribute*

- [Development](contributing/development.md) — local commands, repo
  conventions.
- [Adding a variant](contributing/adding-a-variant.md) — new framework or
  layout.
- [Adding a feature](contributing/adding-a-feature.md) — new opt-in feature
  layer (e.g. Drizzle, Stripe).
- [Testing](contributing/testing.md) — what the scaffold suite covers and
  how to extend it.
- [Release process](contributing/release-process.md) — changesets, OIDC
  publish, version policy.

## Conventions

- All paths in these docs are relative to the repo root unless prefixed with
  `<output>/`, which means "inside a scaffolded project."
- Code references use `path/to/file.ts:line` so they're navigable.
- `@turbocraft/core` and `@turbocraft/templates` are *internal* workspace
  packages — they have no published versions and should not be referenced
  by external consumers.
