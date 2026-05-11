---
"turbocraft": minor
---

Make shadcn/ui opt-in and let the wizard pick the preset and components.

Generated projects no longer ship 56 pre-built components and the
radix/phosphor/cmdk/vaul/embla dependency tree by default. The wizard
asks whether to include shadcn at all. If yes, it offers the default
preset (base-lyra + phosphor + neutral, code `buFznsW`) or accepts a
custom code from <https://ui.shadcn.com/create>, and lets the user
pick components from the live registry (all / select / none). Press
`a` in the multiselect to toggle every option on or off.

The custom-preset input accepts whatever the shadcn site copies —
a bare code, `--preset code`, or the full
`pnpm dlx shadcn@latest …` line — and reduces it to the code.

Selecting Better Auth now auto-includes both Convex and shadcn via
the existing compatibility fixpoint, since the bundled sign-in,
sign-up, and reset-password pages depend on shadcn primitives.

New CLI flags `--shadcn-preset <code>` and `--shadcn-components
<all|none|list>` skip the follow-up prompts and implicitly enable
the feature even when it isn't listed in `--features`.

Two error-UX bugs are fixed along the way:

- `InvalidConfig` failures used to render as "An error has
  occurred"; every schema issue is now printed on its own line.
- The positional project name is validated up front with a hint
  that the value is a kebab-case slug, not a path, so users no
  longer click through the entire wizard before learning their
  input is malformed.
