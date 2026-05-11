# Getting started

`turbocraft` scaffolds a production-ready full-stack monorepo (or single app)
in one command. This guide takes you from zero to a running dev server.

## Requirements

- Node.js **>=22.12.0**. Lower versions will fail at startup.
- A package manager: `pnpm` (recommended), `npm`, or `bun`.
- `git` on `PATH` if you want auto-init (default).

## Install and run

You don't install `turbocraft` globally — invoke it via your package
manager's one-shot runner:

```bash
# pnpm
pnpm dlx turbocraft create my-app

# npm
npm create turbocraft@latest my-app

# bun
bunx turbocraft create my-app
```

The first form forwards to the `create` subcommand; the second uses the
`create-turbocraft` shim that npm's `create` convention requires. Both end
up running the same scaffold.

> Tip: `turbocraft my-app` (no `create`) works too — the CLI normalises argv
> so the project name flows straight to `create`. See
> [CLI reference](cli-reference.md#argv-normalisation).

## Interactive walkthrough

Running without flags drops you into a wizard:

```text
turbocraft create

  Project name           > my-app
  Framework              > Next.js
  Layout                 > Monorepo (apps/ + packages/)
  Features               > [x] shadcn/ui  [x] Convex  [x] Better Auth
  shadcn preset          > Default (base-lyra + phosphor + neutral)
  Components to install  > Select   (then multi-select from the live registry)
  Package manager        > pnpm
  Install dependencies?  > Yes
  Initialise git?        > Yes
```

Answers map 1:1 to the flags below.

## Non-interactive (CI / scripting)

Every prompt has a flag. Anything you pass on the command line is treated as
already-answered and the wizard skips it:

```bash
turbocraft create my-app \
  --framework nextjs \
  --layout monorepo \
  --features shadcn,convex,better-auth \
  --shadcn-preset buFznsW \
  --shadcn-components button,card,input,label \
  --pm pnpm \
  --install \
  --git
```

`--shadcn-preset` accepts any code from
[ui.shadcn.com/create](https://ui.shadcn.com/create); the default
`buFznsW` is base-lyra + phosphor icons + neutral baseColor.
`--shadcn-components` is `all`, `none`, or a comma-separated list of
component names.

To scaffold _without_ running install or git (useful in tests):

```bash
turbocraft create /tmp/probe \
  --framework tanstack --layout single \
  --no-install --no-git
```

The target directory must be empty (or not yet exist); turbocraft refuses
to write over an existing project.

## What you get

A turborepo (or single-app) with:

- **pnpm 10** workspaces, catalog-driven versioning, Turbo 2.9 pipelines.
- **TypeScript 6** strict mode + Vitest (jsdom) + oxlint + oxfmt + knip.
- **Tailwind 4** baked in for every variant.
- **Effect.ts** with the `@effect/language-service` typecheck patch wired in.
- Optional **shadcn/ui** layer: opt-in, choose a preset (default
  base-lyra + phosphor + neutral, or paste your own from
  [ui.shadcn.com/create](https://ui.shadcn.com/create)), and pick which
  components to install (none / specific list / all).
- Optional **Convex** (with schema dir) and **Better Auth** (auto-includes
  Convex + shadcn) layers.
- A `turbo/generators/` Plop config — run `turbocraft add app` or
  `turbo gen run app` inside the project to extend it.

## First run inside the project

```bash
cd my-app
pnpm dev      # or npm/bun run dev
```

Open the URL printed by the dev server. Type-check and lint:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Where to go next

- [CLI reference](cli-reference.md) for every flag.
- [Variants and features](variants.md) to pick the right starting point.
- [Troubleshooting](troubleshooting.md) if something didn't work.
