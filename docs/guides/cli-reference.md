# CLI reference

Complete reference for every `turbocraft` command, flag, positional, and
environment variable.

## Synopsis

```text
turbocraft <command> [args]
turbocraft <name> [flags]              # implicit `create`
```

Implemented in [`apps/cli/src/main.ts`](../../apps/cli/src/main.ts).

## Commands

| Command  | Purpose                                                    |
| -------- | ---------------------------------------------------------- |
| `create` | Scaffold a new project. Default if no subcommand is given. |
| `add`    | Run a generator inside an existing turbocraft project.     |
| `doctor` | Sanity-check a turbocraft-generated project.               |

### `turbocraft create [name]`

Scaffold a new project. With no flags, drops into the interactive wizard.

Source: [`apps/cli/src/commands/create.ts`](../../apps/cli/src/commands/create.ts).

| Flag                  | Type       | Description                                                                                       |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `name`                | positional | Project name. Must be kebab-case (`[a-z][a-z0-9-]*`).                                             |
| `--framework`         | string     | `nextjs` \| `tanstack`.                                                                           |
| `--layout`            | string     | `monorepo` \| `single`.                                                                           |
| `--features`          | string     | Comma-separated subset of `shadcn`, `convex`, `better-auth`.                                      |
| `--shadcn-preset`     | string     | shadcn preset code. Defaults to the built-in `buFznsW` (base-lyra + phosphor + neutral).          |
| `--shadcn-components` | string     | `all`, `none`, or comma-separated names (e.g. `button,card`). Default in non-interactive: `none`. |
| `--pm`                | string     | `pnpm` \| `npm` \| `bun`. Defaults to `pnpm`.                                                     |
| `--install`           | boolean    | Run `<pm> install` after scaffolding. Default `true`.                                             |
| `--git`               | boolean    | `git init` after scaffolding. Default `true`.                                                     |

The target directory must be empty (or not yet exist). If it contains files,
`turbocraft create` aborts before any prompts and lists the conflicting entries.

Validation: project name and all enum-typed flags are parsed via Zod schemas
in [`packages/core/src/schema.ts`](../../packages/core/src/schema.ts). The
config-level refinement enforces that `better-auth` requires both `convex`
and `shadcn`, and that selecting the `shadcn` feature must come with a
`shadcn` config block (preset + components).

Either `--shadcn-preset` or `--shadcn-components` implies the `shadcn`
feature even if it isn't listed in `--features`. Selecting `better-auth`
auto-includes `convex` and `shadcn` via the feature compatibility fixpoint
(`expandFeatureRequires`).

Example:

```bash
turbocraft create my-app \
  --framework tanstack --layout monorepo \
  --features shadcn,convex,better-auth \
  --shadcn-preset buFznsW --shadcn-components all \
  --pm pnpm
```

When the `shadcn` feature is on, `pnpm install` is followed by an
automatic `shadcn init` (and `shadcn add` for the requested components)
inside the right cwd: project root for single-app, `packages/ui` for
monorepo. If either step fails, the outro prints the equivalent
`pnpm dlx shadcn@latest …` command so you can finish by hand — the repo
is always left runnable.

### `turbocraft add <kind>`

Run a Plop generator inside an existing turbocraft project. Thin wrapper
over `pnpm turbo gen run <kind>` — you only need to learn one verb.

Source: [`apps/cli/src/commands/add.ts`](../../apps/cli/src/commands/add.ts).

| Flag    | Type       | Description                                  |
| ------- | ---------- | -------------------------------------------- |
| `kind`  | positional | Generator name (`app`, `page`, ...).         |
| `--cwd` | string     | Project root. Defaults to current directory. |

Generators ship under `<output>/turbo/generators/` and are copied verbatim
from the template tree at scaffold time. See
[Templates system](../architecture/templates-system.md#plop-generators).

### `turbocraft doctor`

Verify a scaffolded project is structurally healthy. Checks for
`package.json`, `tsconfig.json`, `.oxlintrc.json`, and (for monorepo
layouts) `turbo.json`, `pnpm-workspace.yaml`, `apps/`, `packages/`.

Source: [`apps/cli/src/commands/doctor.ts`](../../apps/cli/src/commands/doctor.ts).

| Flag    | Type   | Description                                  |
| ------- | ------ | -------------------------------------------- |
| `--cwd` | string | Project root. Defaults to current directory. |

Exit code is non-zero if any required file is missing.

## Argv normalisation

`turbocraft` injects an implicit `create` when the first positional isn't a
known subcommand and isn't a help/version flag. The following are equivalent:

```bash
turbocraft my-app --framework nextjs
turbocraft create my-app --framework nextjs
```

Implementation: [`apps/cli/src/main.ts`](../../apps/cli/src/main.ts).

## Environment variables

| Variable                    | Used by                 | Description                                                                                                                        |
| --------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `TURBOCRAFT_TEMPLATES_ROOT` | `@turbocraft/templates` | Override the path to the template tree. Set automatically by the published CLI; only relevant for local development or sandboxing. |

See [Build and bundling](../architecture/build-and-bundling.md#templates-resolution)
for how the published CLI locates its bundled templates.

## Exit codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 0    | Success.                                                    |
| 1    | Scaffold or generator failure (Effect cause printed).       |
| 1    | User cancelled the wizard.                                  |
| _n_  | `turbocraft add` passes through the wrapped process's code. |
