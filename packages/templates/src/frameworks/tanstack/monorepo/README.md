# tanstack-monorepo-template

Turborepo template for TanStack Start apps backed by a shared shadcn/ui
component library. Optimized for fast tooling: Oxlint, Oxfmt, Vite, and
pnpm catalogs.

## Stack

- **Runtime:** TanStack Start (Vite + Nitro), TanStack Router file-based
  routes, React 19, TypeScript 6
- **Styling:** Tailwind CSS v4, shadcn/ui (`base-lyra` style, Phosphor icons)
- **Backend:** Convex 1.37 (reactive document store) + Better Auth 1.6
  (`@convex-dev/better-auth/react-start` helpers)
- **Build:** Turborepo 2.9 with transit-node task topology
- **Lint/Format:** Oxlint + Oxfmt (registered as Root Tasks)
- **Tests:** Vitest 4, Testing Library, jsdom, fast-check
- **Package manager:** pnpm 10 with workspace catalog

## Layout

```
apps/
  web/                     TanStack Start app (Vite, Nitro SSR)
    src/
      routes/              File-based routes (TanStack Router)
      components/          App-local React components + providers
      lib/                 App-local helpers (auth client/server, etc.)
      router.tsx           Router + QueryClient + ConvexQueryClient wiring
    convex/                Convex backend functions, schema, auth wiring
    vite.config.ts         Vite + tanstackStart plugin config
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

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local

# In apps/web/, run Convex once. It logs you in, creates a deployment,
# and writes CONVEX_DEPLOYMENT + VITE_CONVEX_URL into .env.local.
pnpm --filter web convex

# Set the Better Auth secret on the Convex deployment.
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"

# Then in two terminals (or split panes):
pnpm --filter web convex   # keeps the Convex backend live
pnpm dev                   # vite dev (TanStack Start)
```

Manually add `VITE_CONVEX_SITE_URL` to `.env.local` (same host as
`VITE_CONVEX_URL`, swap the `.cloud` for `.site`).

Requires Node >= 20 (`.npmrc` pins 22.20.0).

## Authentication

Auth is wired with [Better Auth](https://better-auth.com) on top of the
[`@convex-dev/better-auth`](https://labs.convex.dev/better-auth) component,
using the `react-start` helpers for SSR. Email + password is on by default;
Google and GitHub OAuth are scaffolded behind env flags.

| File                                     | Purpose                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/convex/auth.ts`                | Better Auth options, social provider config, mock email                           |
| `apps/web/convex/http.ts`                | Mounts `/api/auth/*` routes onto the Convex HTTP router                           |
| `apps/web/src/lib/auth-server.ts`        | Server helpers: `getToken`, `handler`, `fetchAuth*`                               |
| `apps/web/src/lib/auth-client.ts`        | Browser auth client (`authClient.signIn`, `authClient.signUp`)                    |
| `apps/web/src/lib/auth-providers.ts`     | Public OAuth-enabled flags read in the UI                                         |
| `apps/web/src/routes/api/auth.$.ts`      | TanStack Router → Convex proxy                                                    |
| `apps/web/src/routes/__root.tsx`         | Wraps the app with `ConvexBetterAuthProvider`, hydrates SSR token in `beforeLoad` |
| `apps/web/src/routes/_unauth/*.tsx`      | Auth UI; pathless layout redirects authed users to `/`                            |
| `apps/web/src/routes/reset-password.tsx` | Hit from password-reset emails (top-level, no auth gate)                          |

### Enabling Google or GitHub OAuth

Set both halves — Convex env (server) and the public flag (client UI):

```bash
npx convex env set GOOGLE_CLIENT_ID "<value>"
npx convex env set GOOGLE_CLIENT_SECRET "<value>"
echo 'VITE_OAUTH_GOOGLE=1' >> apps/web/.env.local
```

Same pattern for GitHub. The provider button only renders when its
`VITE_OAUTH_*` flag is `1`.

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
pnpm dev                # turbo run dev (persistent)
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
pnpm gen app       # scaffold a new TanStack Start app under apps/<name>
pnpm gen page      # add a route to an existing app
```

**`app`** scaffolds `apps/<name>/` with a `package.json` (catalog refs
only), the shared `tsconfig`/`vite`/`vitest` plumbing, a Tailwind v4
`__root.tsx` that imports `@workspace/ui/globals.css`, a smoke test, and
a shadcn `components.json`. It then prompts:

- _Wire in Convex backend?_ Adds `convex/` (config, schema), the
  `ConvexQueryClient` wiring in `router.tsx`, and `convex` script.
- _Wire in Better Auth (requires Convex)?_ Mirrors `apps/web`'s auth
  setup: `convex/{auth,auth.config,http}.ts`,
  `src/lib/auth-{server,client,providers}.ts`, and
  `src/routes/api/auth.$.ts`.

After generating, run `pnpm install` to wire the workspace links.
Convex apps need `pnpm --filter <name> convex` once to bootstrap the
Convex deployment + `_generated/` types.

**`page`** prompts for the target app and route path, then offers
checkboxes for sibling files. Route paths follow TanStack Router
file conventions:

- `dashboard` → `src/routes/dashboard.tsx`
- `posts/$id` → `src/routes/posts/$id.tsx` (dynamic segment)
- `_authed/dashboard` → pathless layout group at
  `src/routes/_authed/dashboard.tsx`

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
