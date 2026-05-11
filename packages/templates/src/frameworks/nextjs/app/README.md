# nextjs-template

Single-package Next.js template with shadcn/ui pre-installed. Optimized
for fast tooling: Oxlint, Oxfmt, Turbopack, and pnpm.

## Stack

- **Runtime:** Next.js 16 (Turbopack), React 19, TypeScript 6
- **Styling:** Tailwind CSS v4, shadcn/ui (`base-lyra` style, Phosphor icons)
- **Backend:** Convex 1.37 (reactive document store) + Better Auth 1.6
- **Lint/Format:** Oxlint + Oxfmt
- **Tests:** Vitest 4, Testing Library, jsdom, fast-check
- **Package manager:** pnpm 10

## Layout

```
app/                 Routes (App Router)
components/          App-local React components + providers
  ui/                shadcn/ui components
convex/              Convex backend functions, schema, auth wiring
hooks/               React hooks
lib/                 Helpers (auth client/server, utils, etc.)
```

Path alias `@/*` resolves to the project root, so:

- `@/components/ui/button`
- `@/lib/utils`
- `@/hooks/use-mobile`
- `@/components/theme-provider`

## Quickstart

```bash
pnpm install
cp .env.example .env.local

# Run Convex once. It logs you in, creates a deployment, and writes
# CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL into .env.local.
pnpm convex

# Set the Better Auth secret on the Convex deployment.
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"

# Then in two terminals (or split panes):
pnpm convex   # keeps the Convex backend live
pnpm dev      # next dev (turbopack)
```

Manually add `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.local` (same host as
`NEXT_PUBLIC_CONVEX_URL`, swap the `.cloud` for `.site`).

Requires Node >= 20 (`.npmrc` pins 22.20.0).

## Authentication

Auth is wired with [Better Auth](https://better-auth.com) on top of the
[`@convex-dev/better-auth`](https://labs.convex.dev/better-auth) component.
Email + password is on by default; Google and GitHub OAuth are scaffolded
behind env flags.

| File                                                      | Purpose                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `convex/auth.ts`                                          | Better Auth options, social provider config, mock email        |
| `convex/http.ts`                                          | Mounts `/api/auth/*` routes onto the Convex HTTP router        |
| `lib/auth-server.ts`                                      | Server helpers: `getToken`, `isAuthenticated`, `handler`       |
| `lib/auth-client.ts`                                      | Browser auth client (`authClient.signIn`, `authClient.signUp`) |
| `lib/auth-providers.ts`                                   | Public OAuth-enabled flags read in the UI                      |
| `app/api/auth/[...all]/route.ts`                          | Next.js -> Convex proxy                                        |
| `components/convex-client-provider.tsx`                   | Wraps the app with `ConvexBetterAuthProvider`                  |
| `app/(unauth)/{sign-in,sign-up,forgot-password}/page.tsx` | Auth UI; group layout redirects authed users to `/`            |
| `app/reset-password/page.tsx`                             | Hit from password-reset emails (top-level, no auth gate)       |

### Enabling Google or GitHub OAuth

Set both halves -- Convex env (server) and the Next.js public flag (client UI):

```bash
npx convex env set GOOGLE_CLIENT_ID "<value>"
npx convex env set GOOGLE_CLIENT_SECRET "<value>"
echo 'NEXT_PUBLIC_OAUTH_GOOGLE=1' >> .env.local
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

```bash
pnpm dev                # next dev --turbopack
pnpm convex             # convex dev
pnpm build              # next build
pnpm start              # next start
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run
pnpm test:watch         # vitest
pnpm test:coverage      # vitest run --coverage

pnpm lint               # oxlint (read-only)
pnpm lint:fix           # oxlint --fix
pnpm format             # oxfmt --check (read-only)
pnpm format:fix         # oxfmt (write)

pnpm quality            # lint + format check
pnpm quality:fix        # lint:fix + format:fix

pnpm check:unused       # knip
```

## Adding shadcn components

Components live in `components/ui/`. Add new ones with the shadcn CLI:

```bash
pnpm dlx shadcn@latest add button
```

`components.json` is preconfigured with `base-lyra` style, neutral base
color, CSS variables, and Phosphor icons.

## Tooling notes

- **`oxfmt` config:** `.oxfmtrc.json` (Prettier-compatible options +
  `sortTailwindcss` for class ordering). Ignore patterns in the same
  file; `.gitignore` is also respected automatically.
