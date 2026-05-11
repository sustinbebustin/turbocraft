# Troubleshooting

Common failure modes and how to recover.

## `Target directory '...' is not empty. Use --force to overwrite.`

`turbocraft create` refuses to scaffold into a non-empty directory unless
you pass `--force`. The check lives in
[`scaffold.ts`](../../apps/cli/src/operations/scaffold.ts) and guards against
accidentally clobbering an existing project.

Recover:

```bash
turbocraft create my-app --force
```

`--force` does not delete existing files; it just lifts the empty-dir guard.
Files with the same destination path as a template asset will be
overwritten in place.

## `Better Auth requires Convex; enable both or neither.`

The `better-auth` feature has a declarative dependency on `convex`. Pass
both or neither:

```bash
--features convex,better-auth        # OK
--features convex                    # OK
--features better-auth               # rejected
```

The rule is encoded in
[`features/better-auth/compatibility.ts`](../../packages/templates/src/features/better-auth/compatibility.ts).

## `No catalog entry '...' was found for catalog 'default'`

When working inside this repo, run `pnpm install` from the repo root, not
from a subpackage and not via `pnpm --prefix`. The catalog resolver only
reads `pnpm-workspace.yaml` when invoked from the workspace root:

```bash
# Works
(cd /path/to/turbocraft && pnpm install)

# Fails with the catalog error
pnpm --prefix /path/to/turbocraft install
```

## Wrong Node version

`turbocraft` requires Node **>=22.12.0**. The check is declared in the
package's `engines` field. If you see an `EBADENGINE` warning, upgrade Node
or use [`fnm`](https://github.com/Schniz/fnm) / `nvm` to switch.

## `doctor` reports `[MISSING]` files

`turbocraft doctor` validates the structural minimum of a generated project:

```bash
turbocraft doctor --cwd ./my-app
```

For monorepo projects it requires `turbo.json`, `pnpm-workspace.yaml`,
`turbo/generators/config.ts`, `apps/`, and `packages/`. For single-app
projects only `package.json`, `tsconfig.json`, and `.oxlintrc.json` are
required.

If something is missing, the project was likely partially overwritten or
edited. Easiest recovery: scaffold fresh into a sibling directory and copy
your custom code across.

## Generator failed inside `turbocraft add`

`turbocraft add <kind>` shells out to `pnpm turbo gen run <kind>`. The exit
code is forwarded. To diagnose:

```bash
pnpm turbo gen run <kind>
```

directly to see Plop's error message in context.

## Package manager mismatch

`--pm pnpm` (default), `--pm npm`, and `--pm bun` only change *which*
install command runs after the scaffold. The generated project itself
always assumes `pnpm` for monorepo variants because the workspace catalog
feature is pnpm-specific. If you want npm or bun, use a single-app variant.

## Where to file bugs

Open an issue at <https://github.com/sustinbebustin/turbocraft/issues>.
Include:

- The full command line.
- The output of `turbocraft doctor` if the project was created.
- Your Node version (`node --version`) and OS.
