---
"turbocraft": minor
---

Generated projects now run Convex and the web app from a single
`pnpm dev`. Monorepos pick up a `dev:convex` turbo task and a root
`dev` script that runs both in parallel; singles use `convex dev
--start` to supervise the frontend from one process.

When `--install` is enabled, the CLI now also configures Convex
end-to-end after dependencies install: it seeds `.env.local`, runs
`convex dev --once` to create a deployment, writes
`*_CONVEX_SITE_URL`, and (when Better Auth is selected) sets
`BETTER_AUTH_SECRET` on the deployment. Each step is best-effort
and the outro lists fallback commands if anything is skipped.
