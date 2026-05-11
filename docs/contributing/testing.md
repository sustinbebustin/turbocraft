# Testing

## Test inventory

| Suite                                                                        | What it covers                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`apps/cli/test/scaffold.test.ts`](../../apps/cli/test/scaffold.test.ts)     | End-to-end scaffold of every variant into a temp dir.   |
| [`packages/core/src/schema.test.ts`](../../packages/core/src/schema.test.ts) | Zod schema parsing + the better-auth/convex refinement. |

Run everything from the repo root:

```bash
pnpm test
```

Or scope to a single package:

```bash
pnpm --filter turbocraft test
pnpm --filter @turbocraft/core test
```

Each package runs vitest in its own working directory; configs live in
`<pkg>/vitest.config.ts`.

## The scaffold suite

`scaffold.test.ts` is the highest-leverage test in the repo. For each
variant it:

1. Materialises the project into a tmp dir via the real `scaffold()`
   pipeline.
2. Asserts the structural minimum (`package.json`, `tsconfig.json`, the
   variant's distinctive files).
3. Cleans up.

It runs with `--no-install --no-git`-equivalent options so each test takes
milliseconds, not seconds. The point isn't to verify the generated project
_builds_ — that's a separate (manual) smoke check. The point is to verify
that the layer composition produces a structurally valid project.

### When to extend it

Add a case whenever you:

- Add a new variant.
- Add a new feature.
- Change a base layer in a way that could change the output shape.

The existing tests are the template.

### When _not_ to extend it

Avoid asserting on file _contents_ unless the test is verifying a specific
templating concern (e.g. that `{{projectName}}` was rendered, that a
`.merge.json` deep-merge produced the right shape). Asserting "this file
contains the literal string X" makes the test brittle and slow without
catching real bugs.

## Schema tests

`schema.test.ts` covers the `ProjectConfig` Zod schema, including:

- Project-name validation (kebab-case requirement).
- Enum parsing for `Framework`, `Layout`, `Feature`, `PackageManager`.
- The better-auth/convex refinement.

When you add a feature with an inter-feature dependency, mirror the rule
in the schema refinement _and_ add a schema test for the rejection path.

## Property tests

For new parsers, validators, or transformations, use
[`fast-check`](https://fast-check.dev/). The core schemas are good
candidates — generate arbitrary inputs, parse, assert round-trip or
invariants. See user-level guidance in `~/.claude/CLAUDE.md` for the
preferred patterns.

## Type-checking as a test

`pnpm typecheck` is part of the verification suite. Failing types are a
test failure — don't merge a PR that emits red squigglies. The Effect
language service patch is applied automatically; if you see strange
errors about `yield*` not satisfying service dependencies, re-run
`pnpm typecheck` (the patch is idempotent but needs to be re-applied
after some pnpm operations).

## Linting + formatting

```bash
pnpm lint           # oxlint, 0 warnings 0 errors expected
pnpm format         # oxfmt check, all files clean expected
pnpm format:fix     # apply formatting
```

`oxlint` is strict — broken-window-style sloppiness will fail it. If you
need to allow an exception, prefer narrowing the rule scope in
`.oxlintrc.json` over file-level `// oxlint-disable` comments.

## CI

Both [`ci.yml`](../../.github/workflows/ci.yml) and
[`release.yml`](../../.github/workflows/release.yml) run the full suite —
`pnpm typecheck && pnpm test && pnpm build`. Release additionally filters
the build to `turbocraft + create-turbocraft` so the cache is warm for the
publish step.
