# turbocraft

Monorepo for the `turbocraft` CLI: scaffolds Next.js / TanStack Start
projects (single-app or monorepo) by composing layered template fragments
under `packages/templates/src/`.

## Essentials

- Package manager: **pnpm** (workspaces + catalog refs).
- `pnpm typecheck` runs `effect-language-service patch && tsc --noEmit` -
  the patch step is required; bare `tsc` will fail.
- Lint/format: **oxlint + oxfmt** (not eslint/prettier). `pnpm format`
  passes `--disable-nested-config` so it doesn't walk into template-asset
  config files.
- Files under `packages/templates/src/**` are output-time assets - excluded
  from typecheck, lint, and format. Don't try to "fix" them in place.

## Editing rule

Two variants diverging on the same template asset is a smell. Hoist
cross-framework assets into `shared/`, cross-layout into the framework
dir; otherwise restrict to a single variant. See
[architecture/templates-system.md](docs/architecture/templates-system.md).

## Documentation

- Architecture: [overview](docs/architecture/overview.md) ·
  [scaffold pipeline](docs/architecture/scaffold-pipeline.md) ·
  [templates system](docs/architecture/templates-system.md) ·
  [CLI internals](docs/architecture/cli-internals.md) ·
  [build & bundling](docs/architecture/build-and-bundling.md)
- Contributing: [development](docs/contributing/development.md) ·
  [adding a variant](docs/contributing/adding-a-variant.md) ·
  [adding a feature](docs/contributing/adding-a-feature.md) ·
  [testing](docs/contributing/testing.md) ·
  [release process](docs/contributing/release-process.md)
- Guides: [getting started](docs/guides/getting-started.md) ·
  [variants](docs/guides/variants.md) ·
  [CLI reference](docs/guides/cli-reference.md) ·
  [troubleshooting](docs/guides/troubleshooting.md)

<!-- effect-solutions:start -->
## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.
<!-- effect-solutions:end -->
