# CLI internals

How the `apps/cli` package is organised, and the conventions you should
match when extending it.

## Source layout

```text
apps/cli/src/
  bin.ts                  Shebang entry; calls run() and pretty-prints fatals.
  main.ts                 citty root command, subcommands, argv normalisation.
  commands/
    create.ts             Scaffold a new project.
    add.ts                Wrap `turbo gen run` inside an existing project.
    doctor.ts             Structural sanity check.
  flow/
    intro.ts              Branded intro / outro banners.
    wizard.ts             clack-driven prompt flow producing a ProjectConfig.
    prompts/              Reusable prompt builders.
  operations/
    scaffold.ts           Orchestrator (Effect program).
    seed.ts               Layer walker; .hbs / .merge.json semantics.
    run-generator.ts      Drives `manifest.initialGenerators` via Plop.
    init-git.ts           git init + initial commit.
    install-deps.ts       pnpm/npm/bun install dispatch.
  services/
    FileSystem.ts         Effect Tag wrapping node:fs/promises.
    PackageManager.ts     pnpm/npm/bun command dispatcher.
    Plop.ts               node-plop runner; satisfies GeneratorRunner.
    Process.ts            Child process spawning.
    Templates.ts          Manifest registry + bundled-root resolution.
  domain/
    errors.ts             Tagged error types (UserCancelled, FsError, ...).
  ui/
    theme.ts              picocolors-backed colour palette.
```

## Effect services

Every side-effectful primitive is an [Effect](https://effect.website/) service.
The pattern:

```ts
export class FileSystemService extends Context.Tag("FileSystemService")<
  FileSystemService,
  {
    readonly readFile: (path: string) => Effect.Effect<string, FsError>;
    readonly writeFile: (
      path: string,
      body: string
    ) => Effect.Effect<void, FsError>;
    // ...
  }
>() {}

export const FileSystemLive = Layer.succeed(FileSystemService /* impl */);
```

Commands compose all five services into a single layer at the top of
`create.ts`:

```ts
Effect.provide(
  Layer.mergeAll(
    FileSystemLive,
    ProcessLive,
    PackageManagerLive,
    PlopLive,
    TemplatesLive
  )
);
```

The orchestrator (`scaffold()`) requires the _union_ of all five service
tags; operations require only the subset they actually use. Adding a new
operation: declare the services it needs in its `Effect.Effect<..., R>`
signature; the type system enforces the layer is provided.

## citty command pattern

Subcommands are `defineCommand({ meta, args, run })`:

- `meta` — name, description, version (root only).
- `args` — flag + positional declarations, used for `--help` rendering.
- `run` — async function receiving parsed `{ args, rawArgs }`.

Boundary parsing pattern: re-parse enum-typed strings through Zod
_inside_ `run`, so the CLI surface stays loose (strings) while the
internal model is exact. See `parseFeatures()` in `create.ts`.

## Wizard flow

`runWizard()` uses `@clack/prompts` (`text`, `select`, `multiselect`,
`confirm`, `group`) and wraps the whole thing in `Effect.tryPromise`. Every
prompt is short-circuited if the corresponding flag was passed on the
command line:

```ts
name: () =>
  input.name !== undefined
    ? Promise.resolve(input.name)
    : text({ message: "Project name", validate: ... })
```

`guard()` converts clack's `isCancel` sentinel into `UserCancelled`. The
final `ProjectConfig.parse(...)` runs the Zod refinement (e.g. the
better-auth / convex constraint).

## Argv normalisation

`turbocraft my-app` and `turbocraft create my-app` both route to `create`.
[`main.ts`](../../apps/cli/src/main.ts) prepends `create` to argv unless the
first token is `create`, `add`, `doctor`, `-h`, `--help`, `-v`, or
`--version`.

## Error rendering

`create.ts` wraps the program in `Effect.runPromiseExit` and renders
`Cause.pretty(cause)` for any `Failure`. This gives users the full Effect
trace (including the Zod path that failed validation) instead of just a
message.

For domain errors that should be user-facing, define them as tagged
classes in [`apps/cli/src/domain/errors.ts`](../../apps/cli/src/domain/errors.ts)
and let them bubble. The Effect `Cause.pretty` formatter does the right
thing.

## Theme

[`apps/cli/src/ui/theme.ts`](../../apps/cli/src/ui/theme.ts) wraps
picocolors with semantic names (`ok`, `err`, `accent`, `muted`, `code`).
Don't import picocolors directly elsewhere — always go through the theme so
colour usage stays consistent and disable-able from one spot.

## TemplatesService — the bundled-root trick

The trickiest service is `Templates`. In source mode (vitest / tsx) the
template tree lives at `packages/templates/src/`. In the published CLI it
ships _inside_ `apps/cli/templates/` (copied by
[`apps/cli/scripts/copy-templates.mjs`](../../apps/cli/scripts/copy-templates.mjs)
at build time, listed in the package's `files` whitelist).

`TemplatesLive` detects the bundled layout and calls `setTemplatesRoot()`
before resolving any manifest:

```ts
const resolveBundledTemplates = (): string | null => {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, "..", "templates");
  return existsSync(candidate) ? candidate : null;
};

const bundled = resolveBundledTemplates();
if (bundled !== null) setTemplatesRoot(bundled);
```

See [Build and bundling](build-and-bundling.md#templates-resolution) for the
full publish-time layout.
