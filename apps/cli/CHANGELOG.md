# turbocraft

## 0.1.3

### Patch Changes

- 5a39092: CLI UX polish:

  - Bundle all runtime dependencies into `dist/bin.mjs` so the published
    `turbocraft` package has zero runtime deps. `pnpm create turbocraft`
    now resolves two packages instead of ~129, cutting the noisy progress
    reporter that ran before the CLI started.
  - Exit cleanly when the wizard is cancelled. Clack still prints
    "Cancelled.", but the trailing Effect stack trace is gone and the
    process exits 1.

## 0.1.2

### Patch Changes

- 800706f: Point the `turbocraft` bin at a committed `bin/turbocraft.mjs` shim
  (which imports from `dist/bin.mjs`) instead of `dist/bin.mjs`
  directly. pnpm materializes bin links during install before any
  build runs, so on fresh checkouts the previous target didn't exist
  yet and pnpm warned about a missing bin while skipping the symlink.
  The shim is checked in, so the link target always exists; the
  underlying program is unchanged.
- bd90089: Ship READMEs in the published tarballs so the package pages on npmjs.com render docs and version badges instead of "no readme data".

## 0.1.1

### Patch Changes

- 5322672: Add README to the create-turbocraft package so it renders on npmjs.com.

## 0.1.0

### Minor Changes

- 61d54b5: Initial release.

  Interactive CLI for scaffolding full-stack monorepo templates:

  - `nextjs-monorepo` - Next.js 16 + apps/+packages/ with shadcn/ui, Effect, optional Convex + Better Auth
  - `nextjs-single` - Next.js single-app
  - `tanstack-monorepo` - TanStack Start + apps/+packages/
  - `tanstack-single` - TanStack Start single-app

  `npm create turbocraft@latest my-app` shells through to `turbocraft create`.

  Requires Node.js >=24.15.0.
