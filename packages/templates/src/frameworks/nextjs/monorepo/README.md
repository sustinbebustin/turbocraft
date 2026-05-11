# nextjs-monorepo-template

Turborepo template for Next.js apps backed by a shared shadcn/ui
component library. Optimized for fast tooling: Oxlint, Oxfmt, Turbopack,
and pnpm catalogs.

## Stack

- **Runtime:** Next.js 16 (Turbopack), React 19, TypeScript 6
- **Styling:** Tailwind CSS v4, shadcn/ui (`base-lyra` style, Phosphor icons)
- **Backend:** Convex 1.37 (reactive document store) + Better Auth 1.6
- **Build:** Turborepo 2.9 with transit-node task topology
- **Lint/Format:** Oxlint + Oxfmt (registered as Root Tasks)
- **Tests:** Vitest 4, Testing Library, jsdom, fast-check
- **Package manager:** pnpm 10 with workspace catalog

## Layout

```
apps/
  web/                     Next.js app (App Router, Turbopack dev)
    app/                   Routes (App Router)
    components/            App-local React components + providers
    convex/                Convex backend functions, schema, auth wiring
    lib/                   App-local helpers (auth client/server, etc.)
packages/
  ui/                      @workspace/ui  shadcn component library
  shared/                  @workspace/shared  cross-app domain code
  typescript-config/       @workspace/typescript-config  shared tsconfigs
turbo/
  generators/              turbo gen scaffolders (see "Code generation")
```

`@workspace/ui` exports:

| Subpath                        | Source                           |
| ------------------------------ | -------------------------------- |
| `@workspace/ui/components/*`   | `packages/ui/src/components/`    |
| `@workspace/ui/hooks/*`        | `packages/ui/src/hooks/`         |
| `@workspace/ui/lib/*`          | `packages/ui/src/lib/`           |
| `@workspace/ui/globals.css`    | `packages/ui/src/styles/`        |
| `@workspace/ui/postcss.config` | `packages/ui/postcss.config.mjs` |

## Quickstart

If you let `turbocraft` install dependencies for you, the Convex deployment,
`apps/web/.env.local`, and Better Auth secret are already set up. Start the
app:

```bash
pnpm dev   # turbo runs `dev` (Next.js) and `dev:convex` in parallel under one TUI
```

### Manual setup (if you skipped install)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local

# First-time only: log in, create a deployment, generate types,
# and write CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL into apps/web/.env.local.
pnpm --filter web exec convex dev --once --configure new

# Set the Better Auth secret on the Convex deployment.
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"

# Optional: NEXT_PUBLIC_CONVEX_SITE_URL is the .site host derived from
# NEXT_PUBLIC_CONVEX_URL (swap .cloud for .site). Add it to
# apps/web/.env.local if you wire OAuth callbacks.

pnpm dev   # Next.js + Convex in parallel under turbo's TUI
```

Requires Node >= 20 (`.npmrc` pins 22.20.0).

## Authentication

Auth is wired with [Better Auth](https://better-auth.com) on top of the
[`@convex-dev/better-auth`](https://labs.convex.dev/better-auth) component.
Email + password is on by default; Google and GitHub OAuth are scaffolded
behind env flags.

| File                                                               | Purpose                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `apps/web/convex/auth.ts`                                          | Better Auth options, social provider config, mock email        |
| `apps/web/convex/http.ts`                                          | Mounts `/api/auth/*` routes onto the Convex HTTP router        |
| `apps/web/lib/auth-server.ts`                                      | Server helpers: `getToken`, `isAuthenticated`, `handler`       |
| `apps/web/lib/auth-client.ts`                                      | Browser auth client (`authClient.signIn`, `authClient.signUp`) |
| `apps/web/lib/auth-providers.ts`                                   | Public OAuth-enabled flags read in the UI                      |
| `apps/web/app/api/auth/[...all]/route.ts`                          | Next.js → Convex proxy                                         |
| `apps/web/components/convex-client-provider.tsx`                   | Wraps the app with `ConvexBetterAuthProvider`                  |
| `apps/web/app/(unauth)/{sign-in,sign-up,forgot-password}/page.tsx` | Auth UI; group layout redirects authed users to `/`            |
| `apps/web/app/reset-password/page.tsx`                             | Hit from password-reset emails (top-level, no auth gate)       |

### Enabling Google or GitHub OAuth

Set both halves — Convex env (server) and the Next.js public flag (client UI):

```bash
npx convex env set GOOGLE_CLIENT_ID "<value>"
npx convex env set GOOGLE_CLIENT_SECRET "<value>"
echo 'NEXT_PUBLIC_OAUTH_GOOGLE=1' >> apps/web/.env.local
```

Same pattern for GitHub. The provider button only renders when its
`NEXT_PUBLIC_OAUTH_*` flag is `1`.

### Email delivery

`convex/auth.ts` ships with `console.log` stubs for verification and
password-reset emails. Replace those handlers with a real provider
([Resend](https://resend.com) is the canonical Convex pairing) before
shipping. Flip `requireEmailVerification: true` once email actually
delivers.

## Scripts

Run from the repo root:

```bash
pnpm build              # turbo run build
pnpm dev                # turbo run dev dev:convex (persistent; Next.js + Convex)
pnpm typecheck          # tsc --noEmit across workspaces
pnpm test               # vitest run
pnpm test:watch         # vitest
pnpm test:coverage      # vitest run --coverage

pnpm lint               # oxlint (read-only)
pnpm lint:fix           # oxlint --fix
pnpm format             # oxfmt --check (read-only)
pnpm format:fix         # oxfmt (write)

pnpm quality            # lint + format check, parallel, cached
pnpm quality:fix        # lint:fix then format:fix, sequenced

pnpm check:unused       # knip
```

`quality` is the recommended CI entry point. `quality:fix` orders
`format:fix` after `lint:fix` to avoid concurrent file writes.

## Adding shadcn components

Components live in `packages/ui/src/components/` and are consumed by
the app via the `@workspace/ui` exports.

To add a new component, run shadcn from the repo root scoped to either
workspace:

```bash
# Add to the shared library (preferred)
pnpm dlx shadcn@latest add button -c packages/ui

# Add to the web app only
pnpm dlx shadcn@latest add button -c apps/web
```

Both workspaces have their own `components.json` configured with
`base-lyra` style, neutral base color, CSS variables, and Phosphor icons.

## Code generation

Two `turbo gen` generators encode the conventions above so adding an
app or a route is a single command:

```bash
pnpm gen           # interactive picker (app | page)
pnpm gen app       # scaffold a new Next.js app under apps/<name>
pnpm gen page      # add a route to an existing app
```

**`app`** scaffolds `apps/<name>/` with a `package.json` (catalog refs
only), the shared `tsconfig`/`postcss`/`vitest` plumbing, a Tailwind v4
layout that imports `@workspace/ui/globals.css`, a smoke test, and a
shadcn `components.json`. It then prompts:

- _Wire in Convex backend?_ Adds `convex/` (config, schema), the
  `ConvexClientProvider`, and `convex` script.
- _Wire in Better Auth (requires Convex)?_ Mirrors `apps/web`'s auth
  setup: `convex/{auth,auth.config,http}.ts`, `lib/auth-{server,client,providers}.ts`,
  and `app/api/auth/[...all]/route.ts`.

After generating, run `pnpm install` to wire the workspace links.
Convex apps need `pnpm --filter <name> exec convex dev --once --configure new`
once to bootstrap the Convex deployment + `_generated/` types.

**`page`** prompts for the target app, route path (route groups like
`(app)/dashboard` and dynamic segments like `blog/[slug]` are allowed),
and `server` vs `client`. It then offers checkboxes for sibling files
that follow the project's boundary conventions:

- `layout.tsx`, `loading.tsx`, `error.tsx` — colocated route conventions.
- `lib/server/<name>.ts` — opens with `import "server-only"` so client
  imports break at build time.
- `lib/actions/<name>.ts` — opens with `"use server"` so it's safely
  callable from client components as an RPC.
- `lib/validations/<name>.ts` — a `zod` schema scaffold.

Generators live in `turbo/generators/`. The templates are checked-in
Handlebars files; edit them when the conventions evolve.

## Tooling notes

- **Oxlint and Oxfmt as Root Tasks.** Per the official Turborepo
  guide, `lint`, `format`, `quality` (and their `:fix` variants) are
  registered as `//#task` root tasks. See `turbo.json`.
- **Transit nodes.** `typecheck`, `test`, and `test:coverage` depend
  on a `transit` task so packages pick up dependency source changes
  without forcing serial builds. See `turbo.json`.
- **No `.env` at repo root.** Per Turborepo guidance, env files
  belong in the apps/packages that consume them.
- **`oxfmt` config:** `.oxfmtrc.json` (Prettier-compatible options +
  `sortTailwindcss` for class ordering). Ignore patterns in the
  same file; `.gitignore` is also respected automatically.
