# Release process

Releases are driven by [changesets](https://github.com/changesets/changesets)
and published via the changesets GitHub Action with OIDC (no npm token
required).

## What gets published

Only two packages ship to npm:

- **`turbocraft`** — the CLI.
- **`create-turbocraft`** — the `npm create` shim.

They form a `fixed` group in [`.changeset/config.json`](../../.changeset/config.json),
so they always bump to the same version.

These packages are **ignored** by changesets (never get version bumps,
never get published):

- `turbocraft-monorepo` (the workspace root).
- `@turbocraft/core`, `@turbocraft/templates` — inlined into the
  `turbocraft` bundle. See
  [Build and bundling](../architecture/build-and-bundling.md).
- `@workspace/typescript-config` — build-time only.

## Creating a changeset

After making changes that should ship to users:

```bash
pnpm changeset
```

Walk through the prompt:

1. **Which packages should be bumped?** Pick `turbocraft`. The fixed group
   ensures `create-turbocraft` follows automatically.
2. **What kind of bump?** `patch`, `minor`, or `major`. Follow semver — a
   new variant or feature is `minor`; a breaking flag rename is `major`.
3. **Summary.** One or two sentences. This becomes the changelog entry.

The result is a markdown file under `.changeset/`. Commit it with the
change itself.

## Local sanity checks before merging

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build --filter=turbocraft --filter=create-turbocraft
```

Optionally smoke the bundle:

```bash
rm -rf /tmp/release-smoke
node apps/cli/dist/bin.mjs create /tmp/release-smoke \
  --framework nextjs --layout monorepo \
  --no-install --no-git
```

## CI on merge to `main`

[`release.yml`](../../.github/workflows/release.yml) runs on every push to
`main`. It:

1. Installs deps with the frozen lockfile.
2. Runs `pnpm typecheck` and `pnpm test`.
3. Builds `turbocraft` + `create-turbocraft`.
4. Hands off to `changesets/action`:
   - If pending changesets exist: opens or updates a **Release PR** that
     applies the version bumps and assembles the changelog. Merging that
     PR triggers the actual publish.
   - If no pending changesets: no-op.

OIDC handles auth — there is no `NPM_TOKEN` in the workflow.
`id-token: write` permission must be granted (it is, on the `release`
job).

## The Release PR

The bot-opened PR named "Version Packages" contains:

- A `package.json` version bump on `turbocraft` and `create-turbocraft`.
- A regenerated `CHANGELOG.md` entry.
- Removal of the consumed `.changeset/*.md` files.

Review the PR like any other — the changelog wording is what users will
see. Merge it when you're happy. The next CI run publishes.

## Hotfixes

For a hotfix that needs to go out without other in-flight changesets:

1. Branch from `main`.
2. Make the fix.
3. `pnpm changeset` with `patch`.
4. Open the PR. After merge to `main`, the Release PR will pick it up.

## Manual publish (escape hatch)

The OIDC publish path is the normal flow. If you need to publish manually
(e.g. CI is broken):

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test
pnpm build --filter=turbocraft --filter=create-turbocraft
pnpm changeset version    # apply bumps locally
pnpm release              # invokes `changeset publish`
```

You'll need an `NPM_TOKEN` with publish rights, and you'll have to push
the version commit and the new tags manually. Avoid this path unless
genuinely necessary.

## Version policy

- **patch**: bug fixes, internal refactors with no user-visible effect.
- **minor**: new variants, new features, new CLI flags (backwards
  compatible).
- **major**: removing/renaming flags, removing variants or features,
  raising the Node engines floor, changing the layer-composition
  semantics in a way that affects generated projects.

Pre-1.0 (`0.x.y`) we have more latitude — breaking changes can land as
minor bumps if they only affect surface area users aren't relying on yet.
Call them out explicitly in the changeset summary regardless.
