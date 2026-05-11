# Development

How to work in this repo.

## Setup

Requirements:

- Node **>=22.12.0** (matches the published CLI's `engines`).
- pnpm 10 (`corepack enable && corepack prepare pnpm@10 --activate`).

Clone and install:

```bash
git clone https://github.com/sustinbebustin/turbocraft.git
cd turbocraft
pnpm install
```

## Common commands

All commands are run from the repo root unless noted. Turbo handles the
fan-out across packages.

| Command            | What it does                                                |
|--------------------|-------------------------------------------------------------|
| `pnpm build`       | Build every package via tsdown.                             |
| `pnpm dev`         | Watch-rebuild every package.                                |
| `pnpm typecheck`   | `tsc --noEmit` everywhere (after Effect LS patch).          |
| `pnpm test`        | Vitest across all packages.                                 |
| `pnpm lint`        | oxlint at the repo root.                                    |
| `pnpm format`      | oxfmt check (`--disable-nested-config`).                    |
| `pnpm format:fix`  | oxfmt write.                                                |

## Smoke-testing the CLI

Build, then run the bundled binary against a scratch directory:

```bash
pnpm build
rm -rf /tmp/tc-test
node apps/cli/dist/bin.mjs create /tmp/tc-test \
  --framework nextjs --layout monorepo \
  --no-install --no-git
```

`--no-install --no-git` keeps the smoke fast and side-effect-free. The
`rm -rf` is needed on repeat runs because turbocraft refuses to scaffold
into a non-empty directory.

To exercise the source code (not the bundle), use the scaffold tests:

```bash
pnpm --filter turbocraft test
```

See [Testing](testing.md) for what's covered.

## Working on templates

Template assets under `packages/templates/src/**` are **not** type-checked
or linted by repo tooling. They're runtime output. To verify a change:

1. Edit the asset.
2. Run the scaffold test:
   `pnpm --filter turbocraft test -- scaffold.test.ts`.
3. For a manual sanity check, smoke-test the CLI (above) into `/tmp/...`
   and open the result.

## Working on the CLI core

When you touch `apps/cli/src/**`:

1. Keep services thin — push logic into operations.
2. Re-parse untyped CLI input through Zod schemas at the command boundary.
3. New errors get tagged classes in
   [`apps/cli/src/domain/errors.ts`](../../apps/cli/src/domain/errors.ts)
   so `Cause.pretty` formats them well.
4. Always consult `effect-solutions` before writing new Effect code — see
   `CLAUDE.md` for the guide locations.

## Working on @turbocraft/core

The core package is intentionally minimal: schemas, types, contracts. If
you find yourself adding I/O or framework-specific code here, it belongs
in `apps/cli` or `@turbocraft/templates` instead.

## Repo conventions

- Effect everywhere a side-effect lives. No raw `fs` calls in operations.
- Errors as values for expected failures; throw only for truly
  exceptional/framework-boundary cases.
- No `any`, no `!`, no unsafe assertions. Parse at boundaries.
- Module structure: small modules around one primary domain type.
  Domain logic lives on the module of its primary type.
- Comments explain *why*, never *what*. Doc comments on exported APIs
  only when the name and signature don't already make it obvious.

## Editor setup

`.vscode/settings.json` is checked in with formatter/lint integration. If
you use a different editor, point its oxlint and oxfmt integration at the
repo root — both tools auto-discover the `.oxlintrc.json` /
`.oxfmtrc.json`.

## Effect language service patch

`pnpm typecheck` runs `effect-language-service patch` first. This patches
`tsc` to understand Effect's `yield*` semantics for service dependencies.
The patch is idempotent and only touches the local `node_modules`.

## Next steps

- [Adding a variant](adding-a-variant.md) — new framework or layout.
- [Adding a feature](adding-a-feature.md) — new opt-in feature.
- [Testing](testing.md) — extending the scaffold suite.
- [Release process](release-process.md) — changesets and publishing.
