---
"turbocraft": patch
---

CLI UX polish:

- Bundle all runtime dependencies into `dist/bin.mjs` so the published
  `turbocraft` package has zero runtime deps. `pnpm create turbocraft`
  now resolves two packages instead of ~129, cutting the noisy progress
  reporter that ran before the CLI started.
- Exit cleanly when the wizard is cancelled. Clack still prints
  "Cancelled.", but the trailing Effect stack trace is gone and the
  process exits 1.
