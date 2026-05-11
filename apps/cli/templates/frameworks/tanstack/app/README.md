# tanstack-template

Single-package template for TanStack Start apps with shadcn/ui components,
Convex, and Better Auth. Optimized for fast tooling: Oxlint, Oxfmt, Vite,
and pnpm.

## Stack

- **Runtime:** TanStack Start (Vite + Nitro), TanStack Router file-based
  routes, React 19, TypeScript 6
- **Styling:** Tailwind CSS v4, shadcn/ui (`base-lyra` style, Phosphor icons)
- **Backend:** Convex 1.37 (reactive document store) + Better Auth 1.6
  (`@convex-dev/better-auth/react-start` helpers)
- **Lint/Format:** Oxlint + Oxfmt
- **Tests:** Vitest 4, Testing Library, jsdom, fast-check
- **Package manager:** pnpm 10

## Layout

```
src/
  routes/                  File-based routes (TanStack Router)
  components/
    theme-provider.tsx     App-local providers
    ui/                    shadcn/ui components
  hooks/                   Custom hooks (use-mobile, etc.)
  lib/
    utils.ts               cn() helper + shared utilities
    auth-{client,server,providers}.ts
  styles/
    globals.css            Tailwind v4 entry + theme tokens
  router.tsx               Router + QueryClient + ConvexQueryClient wiring
convex/                    Convex backend functions, schema, auth wiring
public/                    Static assets
vite.config.ts             Vite + tanstackStart plugin config
```

Path aliases: `@/*` and `~/*` both resolve to `src/*`.

## Quickstart

If you let `turbocraft` install dependencies for you, the Convex deployment,
`.env.local`, and Better Auth secret are already set up. Start the app:

```bash
pnpm dev   # convex dev --start "vite dev" (Convex backend + TanStack Start in one terminal)
```

### Manual setup (if you skipped install)

```bash
pnpm install
cp .env.example .env.local

# First-time only: log in, create a deployment, generate types,
# and write CONVEX_DEPLOYMENT + VITE_CONVEX_URL into .env.local.
pnpm exec convex dev --once --configure new

# Set the Better Auth secret on the Convex deployment.
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"

# Optional: VITE_CONVEX_SITE_URL is the .site host derived from
# VITE_CONVEX_URL (swap .cloud for .site). Add it to .env.local if
# you wire OAuth callbacks.

pnpm dev   # convex dev + vite dev, one terminal
```

Requires Node >= 20 (`.npmrc` pins 22.20.0).

## Authentication

Auth is wired with [Better Auth](https://better-auth.com) on top of the
[`@convex-dev/better-auth`](https://labs.convex.dev/better-auth) component,
using the `react-start` helpers for SSR. Email + password is on by default;
Google and GitHub OAuth are scaffolded behind env flags.

| File                            | Purpose                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `convex/auth.ts`                | Better Auth options, social provider config, mock email                           |
| `convex/http.ts`                | Mounts `/api/auth/*` routes onto the Convex HTTP router                           |
| `src/lib/auth-server.ts`        | Server helpers: `getToken`, `handler`, `fetchAuth*`                               |
| `src/lib/auth-client.ts`        | Browser auth client (`authClient.signIn`, `authClient.signUp`)                    |
| `src/lib/auth-providers.ts`     | Public OAuth-enabled flags read in the UI                                         |
| `src/routes/api/auth.$.ts`      | TanStack Router → Convex proxy                                                    |
| `src/routes/__root.tsx`         | Wraps the app with `ConvexBetterAuthProvider`, hydrates SSR token in `beforeLoad` |
| `src/routes/_unauth/*.tsx`      | Auth UI; pathless layout redirects authed users to `/`                            |
| `src/routes/reset-password.tsx` | Hit from password-reset emails (top-level, no auth gate)                          |

### Enabling Google or GitHub OAuth

Set both halves — Convex env (server) and the public flag (client UI):

```bash
npx convex env set GOOGLE_CLIENT_ID "<value>"
npx convex env set GOOGLE_CLIENT_SECRET "<value>"
echo 'VITE_OAUTH_GOOGLE=1' >> .env.local
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

```bash
pnpm dev                # convex dev --start "vite dev" (both in one terminal)
pnpm dev:web            # vite dev only
pnpm dev:convex         # convex dev only
pnpm build              # vite build
pnpm start              # node .output/server/index.mjs
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run
pnpm test:watch         # vitest
pnpm test:coverage      # vitest run --coverage

pnpm lint               # oxlint (read-only)
pnpm lint:fix           # oxlint --fix
pnpm format             # oxfmt --check (read-only)
pnpm format:fix         # oxfmt (write)

pnpm quality            # lint + format check
pnpm quality:fix        # lint:fix then format:fix

pnpm check:unused       # knip
```

## Adding shadcn components

Components live in `src/components/ui/`. Add new ones with:

```bash
pnpm dlx shadcn@latest add button
```

`components.json` is configured with `base-lyra` style, neutral base color,
CSS variables, and Phosphor icons.

## Tooling notes

- **`oxfmt` config:** `.oxfmtrc.json` (Prettier-compatible options +
  `sortTailwindcss` for class ordering against `src/styles/globals.css`).
  `.gitignore` patterns are respected automatically.
