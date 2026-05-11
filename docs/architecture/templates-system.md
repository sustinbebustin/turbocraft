# Templates system

The template tree under [`packages/templates/src/`](../../packages/templates/src/)
is the *only* place where output assets live. A variant is just a manifest
that declares which subtrees to overlay, in what order, into the target
directory.

## Directory shape

```text
packages/templates/src/
  shared/
    base/                    Shared between all single-app variants.
    monorepo/                Shared between all monorepo variants
                             (ui package, shared package, root config).
  frameworks/
    nextjs/
      app/                   Single-app Next.js source.
      monorepo/              Monorepo Next.js (apps/web + framework root).
      oxlint/                Framework-specific oxlint patches.
      generators/            Plop generators, copied verbatim to output.
    tanstack/                Same shape.
  features/
    convex/
      compatibility.ts       { requires: Feature[] }
      files/                 Always-at-root assets (convex/ schema dir).
      deps/single/package.json.merge.json
      deps/monorepo/package.json.merge.json
      nextjs/files/          Next.js-specific feature files.
      tanstack/files/        TanStack-specific feature files.
      tanstack/deps/...
    better-auth/             Same shape as convex.
  variants/
    nextjs-monorepo.ts       Manifests that compose the above into one
    nextjs-single.ts         scaffold.
    tanstack-monorepo.ts
    tanstack-single.ts
  index.ts                   Registry + compatibility + root resolver.
```

## Manifest schema

From [`packages/core/src/manifest.ts`](../../packages/core/src/manifest.ts):

```ts
type CopyEntry = {
  readonly from: string;  // path relative to templates root
  readonly to:   string;  // path inside the generated project ("." = root)
};

type TemplateManifest = {
  readonly id: VariantId;
  readonly layers: ReadonlyArray<CopyEntry>;
  readonly featureLayers?: Readonly<
    Partial<Record<Feature, ReadonlyArray<CopyEntry>>>
  >;
  readonly generators?: { readonly source: string; readonly destination: string };
  readonly initialGenerators: ReadonlyArray<GeneratorRef>;
  readonly supportedFeatures: ReadonlyArray<Feature>;
};
```

A real example — [`variants/nextjs-monorepo.ts`](../../packages/templates/src/variants/nextjs-monorepo.ts):

```ts
export const manifest: TemplateManifest = {
  id: "nextjs-monorepo",
  layers: [
    { from: "shared/monorepo",            to: "." },
    { from: "frameworks/nextjs/monorepo", to: "." },
  ],
  featureLayers: {
    convex: [
      { from: "features/convex/files",          to: "apps/web" },
      { from: "features/convex/deps/monorepo",  to: "apps/web" },
      { from: "features/convex/nextjs/files",   to: "apps/web" },
    ],
    "better-auth": [
      { from: "features/better-auth/deps/monorepo", to: "apps/web" },
      { from: "features/better-auth/nextjs/files",  to: "apps/web" },
    ],
  },
  generators: { source: "frameworks/nextjs/generators", destination: "turbo/generators" },
  initialGenerators: [],
  supportedFeatures: ["convex", "better-auth"],
};
```

## File-type semantics

The scaffolder walks each layer's `from` directory recursively and processes
files according to suffix:

| Suffix         | Behaviour                                                       |
|----------------|-----------------------------------------------------------------|
| `*.hbs`        | Compile with Handlebars, write to dest without the `.hbs` ext.  |
| `*.merge.json` | Parse as JSON, deep-merge into an accumulator keyed by dest.    |
| (anything else)| Copy verbatim, overwriting existing dest if any.                |

### Handlebars context

Every `.hbs` file is rendered with the same answer bag:

```ts
{
  projectName:    string,    // e.g. "my-app"
  withConvex:     boolean,   // convex feature enabled
  withBetterAuth: boolean,   // better-auth feature enabled
}
```

Helpers come from
[`packages/core/src/handlebars-helpers.ts`](../../packages/core/src/handlebars-helpers.ts)
and are registered on a private Handlebars instance per scaffold run (so
they don't leak globally).

> Plop generators use the wider answer bag declared by the generator
> itself; the three keys above are *also* merged in, so generator templates
> can reference `projectName` etc.

### Deep-merge rules

For `.merge.json` files (used to compose `package.json` from many sources):

- Objects: merge recursively, last-write-wins on conflicting primitives.
- Arrays: concatenate; primitives are deduped, objects are not.
- Mismatched types: later value wins.

Defined in `deepMerge()` at
[`apps/cli/src/operations/seed.ts`](../../apps/cli/src/operations/seed.ts).

### Verbatim conflict resolution

Within a single scaffold, later layers overwrite earlier ones. The
ordering matters:

1. Base `layers` apply first, in declaration order.
2. Then each enabled feature's `featureLayers`, in declaration order of
   the keys.

This is why "two variants diverging on the same asset" is an architectural
smell — the right fix is almost always to hoist into `shared/` or a
framework-level dir, not to duplicate.

## Plop generators

`manifest.generators` declares a verbatim copy from a framework-level
generator directory (e.g. `frameworks/nextjs/generators/`) to
`<output>/turbo/generators/`. The result: the generated project has its
own working `turbo gen run app` / `turbo gen run page`. `turbocraft add`
is a thin wrapper over the same generators.

`initialGenerators` is currently **empty for every variant**. The project
is materialised entirely by layers; generators are for *extending* the
project post-scaffold.

## Compatibility metadata

```ts
// packages/templates/src/features/better-auth/compatibility.ts
export const compatibility: FeatureCompatibility = {
  requires: ["convex"],
};
```

Loaded by `loadCompatibility()` from `@turbocraft/templates` and consumed by
the wizard. Adding a new feature with a `requires` declaration immediately
gates the relevant CLI options — no edits in the CLI.

## Templates-root resolution

`@turbocraft/templates` exposes `templatesRoot()`, which resolves the
template tree's filesystem location:

1. Explicit override via `setTemplatesRoot(path)`.
2. `TURBOCRAFT_TEMPLATES_ROOT` env var.
3. Heuristic: if `import.meta.url` lives under a `/src` dir, that's the
   root (source mode — tsx / vitest).
4. Otherwise resolve `../src` from the built `dist/` (workspace dev).

The published CLI calls `setTemplatesRoot()` at startup with the bundled
`apps/cli/templates/` path. See
[Build and bundling](build-and-bundling.md#templates-resolution).
