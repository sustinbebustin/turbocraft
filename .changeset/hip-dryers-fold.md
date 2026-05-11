---
"turbocraft": patch
---

Point the `turbocraft` bin at a committed `bin/turbocraft.mjs` shim
(which imports from `dist/bin.mjs`) instead of `dist/bin.mjs`
directly. pnpm materializes bin links during install before any
build runs, so on fresh checkouts the previous target didn't exist
yet and pnpm warned about a missing bin while skipping the symlink.
The shim is checked in, so the link target always exists; the
underlying program is unchanged.
