# Variants and features

`turbocraft` ships four variants, each materialised from a manifest in
[`packages/templates/src/variants/`](../../packages/templates/src/variants/).

## Variants

| Variant id          | Framework      | Layout   | Description                                            |
| ------------------- | -------------- | -------- | ------------------------------------------------------ |
| `nextjs-monorepo`   | Next.js 16     | Monorepo | `apps/web` + `packages/{ui,shared,typescript-config}`. |
| `nextjs-single`     | Next.js 16     | Single   | Standalone Next.js app, no workspaces.                 |
| `tanstack-monorepo` | TanStack Start | Monorepo | `apps/web` + shared packages.                          |
| `tanstack-single`   | TanStack Start | Single   | Standalone TanStack Start app.                         |

A variant id is derived from `framework` + `layout`. See
[`variantIdFor()`](../../packages/core/src/schema.ts).

## What every variant ships with

Regardless of framework or layout:

- **pnpm 10** with catalog-driven versioning. Monorepo variants use
  `catalog:` refs; single-app variants pin versions directly.
- **Turborepo 2.9** task pipelines (`build`, `dev`, `test`, `typecheck`,
  `lint`).
- **TypeScript 6** in strict mode, with shared `tsconfig` bases.
- **Vitest 4** with the jsdom environment.
- **oxlint** + **oxfmt** for linting and formatting (no ESLint/Prettier).
- **knip** for dead-code detection.
- **Tailwind 4** for styling.
- **Effect.ts** with the `@effect/language-service` typecheck patch wired
  into the project's `typecheck` script.

## Optional features

Features are opt-in layers applied _after_ the base variant. Enable them
with `--features convex,better-auth` or via the wizard.

| Feature       | What it adds                                                                                                                                              | Requires           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `shadcn`      | `components.json`, `lib/utils.ts`, theme provider, Toaster wiring; runs `shadcn init` post-install. Choose preset + which components to install (or all). | —                  |
| `convex`      | `convex/` schema dir, client wiring, scripts, dependency entries.                                                                                         | —                  |
| `better-auth` | Auth providers, client, route handlers, env scaffolding.                                                                                                  | `shadcn`, `convex` |

Compatibility is declared per-feature in
[`packages/templates/src/features/<id>/compatibility.ts`](../../packages/templates/src/features/)
and loaded via `loadCompatibility()` — the wizard auto-respects new
constraints without code changes in the CLI.

## Feature × variant matrix

All four variants currently support both features. The `supportedFeatures`
list on each manifest gates which flags the CLI surfaces — if you fork a
variant that doesn't support a feature, just omit it from that array.

## Picking a variant

- **Building a single product, want to scale later?** Start with the
  monorepo variant for your preferred framework. The shared `packages/shared`
  workspace gives you a place to extract code without retrofitting; opting
  in to `shadcn` adds a `packages/ui` workspace for shared components.
- **Quick prototype, single deployable?** Pick the single-app variant. You
  can always migrate later by hoisting code into a fresh monorepo scaffold.
- **Next.js vs TanStack Start?** Next.js is the better-trodden path with
  more ecosystem tooling. TanStack Start gives you a TanStack Router-first
  experience with file-based routing and Vite under the hood.

For internals of how variants compose layers, see
[Templates system](../architecture/templates-system.md).
