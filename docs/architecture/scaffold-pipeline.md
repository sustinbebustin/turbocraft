# Scaffold pipeline

End-to-end walkthrough of what happens when a user runs
`turbocraft create my-app`.

## Entry points

```text
  apps/cli/src/bin.ts        shebang + top-level catch
        |
        v
  apps/cli/src/main.ts       citty `defineCommand`, argv normalisation
        |
        v
  apps/cli/src/commands/create.ts
```

`main.ts` injects an implicit `create` when the first non-flag token isn't a
known subcommand, so `turbocraft my-app` and `turbocraft create my-app`
take the same path.

## Argument parsing

`create.ts` declares its flags via citty `args`. Enum-typed flags are
re-parsed through Zod schemas from `@turbocraft/core`:

```ts
const framework = args.framework ? Framework.parse(args.framework) : undefined;
const layout    = args.layout    ? Layout.parse(args.layout)       : undefined;
const features  = parseFeatures(args.features);
const pm        = args.pm        ? PackageManager.parse(args.pm)   : undefined;
```

This is the boundary at which untrusted CLI input becomes typed internal
state. After this point, the rest of the pipeline is fully type-safe.

## Wizard

`runWizard()` ([`apps/cli/src/flow/wizard.ts`](../../apps/cli/src/flow/wizard.ts))
fills in any answers not supplied on the command line. Flags that were
passed are treated as already-answered. The output is a fully validated
`ProjectConfig` (Zod-refined; the better-auth / convex constraint runs here).

Cancellation at any clack prompt raises `UserCancelled` — surfaced as
exit code 1 with a `Cancelled.` message.

## Scaffold

`scaffold(config)` ([`apps/cli/src/operations/scaffold.ts`](../../apps/cli/src/operations/scaffold.ts))
is the orchestrator. It runs as an `Effect.Effect<ScaffoldReport, ...>`,
requiring five services injected by the layer in `create.ts`:

```text
  FileSystemLive     fs.* primitives (read/write/copy/exists/empty-check)
  ProcessLive        spawn child processes (git, pnpm/npm/bun)
  PackageManagerLive thin wrapper over Process for `install` invocations
  PlopLive           node-plop runner
  TemplatesLive      manifest registry + bundled-root resolution
```

Phases:

### 1. Resolve manifest

```ts
const variantId = variantIdFor(config.framework, config.layout);
const manifest  = yield* templates.get(variantId);
```

`TemplatesService.get` looks up the variant in the registry from
`@turbocraft/templates` and returns its `TemplateManifest`.

### 2. Empty-dir guard

The target dir must be empty (or not yet exist). The check uses
`fs.listEntries()` and fails with `TargetDirNotEmpty({ path, conflicts })`
if it finds any entries. The wizard also runs this check earlier - inline
while the user is typing a name, and up front when `--name` is passed
non-interactively - so the user doesn't reach the scaffold step with a
known-bad target.

### 3. Seed layers

```ts
yield* seedTarget({ manifest, targetDir, features, answers });
```

`seedTarget` ([`apps/cli/src/operations/seed.ts`](../../apps/cli/src/operations/seed.ts))
walks the manifest's `layers` in order, then each enabled feature's
`featureLayers`. For every file:

- `*.hbs` → rendered with Handlebars (helpers from `@turbocraft/core`),
  written without the `.hbs` suffix. Render context: `projectName`,
  `withConvex`, `withBetterAuth`.
- `*.merge.json` → deep-merged into an accumulator keyed by destination
  path. Flushed after all layers run; merged into any existing file at
  the destination.
- everything else → copied verbatim. Later layers overwrite earlier ones
  at the same destination.

See [Templates system](templates-system.md) for the full file-type semantics
and deep-merge rules.

### 4. Initial generators

```ts
yield* runInitialGenerators({ manifest, targetDir, answers });
```

Each entry in `manifest.initialGenerators` is invoked via Plop with merged
answers. **Current variants leave this empty** — the entire project is
materialised by layers. Generators only run post-scaffold via
`turbocraft add` / `turbo gen run`.

### 5. `git init`

If `config.git`, `initGit()` runs `git init` + an initial commit. Failures
do not abort the scaffold (they're logged but non-fatal — a partially
scaffolded project without git is still useful).

### 6. Install dependencies

If `config.install`, `installDeps()` runs `<pm> install` in the target dir
via the `PackageManager` service. The command is forwarded to the user's
chosen pm; output is streamed.

## Report

`scaffold` returns:

```ts
type ScaffoldReport = {
  readonly variant: string;
  readonly targetDir: string;
  readonly created: ReadonlyArray<string>;  // files seeded + generated
  readonly installed: boolean;
  readonly gitInitialised: boolean;
};
```

`create.ts` renders this via the clack outro with next-step hints
(`cd <dir>; pnpm dev` etc.).

## Error model

Failures bubble up as Effect errors with structured tags:

| Tag              | Origin                                              |
|------------------|-----------------------------------------------------|
| `UserCancelled`  | Wizard cancellation.                                |
| `InvalidConfig`  | Zod refinement failure post-wizard.                 |
| `FsError`        | Filesystem op (ensure-empty, read, write, mkdir).   |
| `ManifestError`  | Unknown variant id.                                 |
| `GeneratorError` | Plop generator failure.                             |
| `ProcessError`   | `git init` / install command non-zero exit.         |

`create.ts` wraps the program in `Effect.runPromiseExit` and prints
`Cause.pretty(...)` on `Failure` — every error gets a structured trace.
