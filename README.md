# turbocraft

[![npm turbocraft package](https://img.shields.io/npm/v/turbocraft.svg?label=turbocraft)](https://npmjs.org/package/turbocraft)
[![npm create-turbocraft package](https://img.shields.io/npm/v/create-turbocraft.svg?label=create-turbocraft)](https://npmjs.org/package/create-turbocraft)
[![license](https://img.shields.io/npm/l/turbocraft.svg)](./LICENSE)

Scaffold a production-ready Next.js or TanStack Start project — monorepo or single-app — with one command.

```bash
npm create turbocraft@latest my-app
```

That's it. Pick a variant, optionally add Convex + Better Auth, and you're running in under a minute.

## Quickstart

```bash
# any of these work
npm create turbocraft@latest my-app
pnpm create turbocraft my-app
bunx create-turbocraft my-app

cd my-app
pnpm dev
```

Prefer non-interactive? Pass flags:

```bash
pnpm dlx turbocraft create my-app \
  --framework nextjs --layout monorepo \
  --features convex,better-auth
```

## Variants

| ID                  | Stack                                       |
|---------------------|---------------------------------------------|
| `nextjs-monorepo`   | Next.js 16 in a Turborepo (`apps/` + `packages/`) |
| `nextjs`            | Next.js 16, single app                      |
| `tanstack-monorepo` | TanStack Start in a Turborepo               |
| `tanstack`          | TanStack Start, single app                  |

Every variant ships the same hand-tuned toolchain:

- pnpm 10 (catalog-driven) + Turbo 2.9
- TypeScript 6, Vitest, oxlint + oxfmt, knip
- shadcn/ui (56 components) + Tailwind 4 + Phosphor Icons
- Effect.ts
- Optional Convex + Better Auth

## Commands

| Command                        | What it does                                                |
|--------------------------------|-------------------------------------------------------------|
| `turbocraft create <name>`     | Scaffold a new project (interactive wizard by default).     |
| `turbocraft add <kind>`        | Run a generator inside a turbocraft project (e.g. `app`, `page`). |
| `turbocraft doctor`            | Diagnose a turbocraft project's environment.                |

See [docs/guides/cli-reference.md](docs/guides/cli-reference.md) for every flag.

## Requirements

- Node.js `>=22.12.0`
- pnpm, npm, or bun for installing the scaffolded project's deps

## Documentation

- **Use it** — [Getting started](docs/guides/getting-started.md) · [CLI reference](docs/guides/cli-reference.md) · [Variants & features](docs/guides/variants.md) · [Troubleshooting](docs/guides/troubleshooting.md)
- **Understand it** — [Architecture](docs/architecture/overview.md) · [Scaffold pipeline](docs/architecture/scaffold-pipeline.md) · [Templates system](docs/architecture/templates-system.md)
- **Contribute** — [Development](docs/contributing/development.md) · [Add a variant](docs/contributing/adding-a-variant.md) · [Add a feature](docs/contributing/adding-a-feature.md)

## License

MIT
