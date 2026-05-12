---
"turbocraft": patch
---

Fix shadcn setup failing in monorepo projects: drop the obsolete `--monorepo` flag from `shadcn init`, run init inside the consuming app, and align monorepo templates with shadcn's documented per-app layout (`@/components/ui/*`).
