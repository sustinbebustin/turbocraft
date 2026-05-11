# Adding a variant

A _variant_ is a (framework, layout) pair that produces one kind of
scaffolded project. The repo currently ships four:

- `nextjs-monorepo`, `nextjs-single`
- `tanstack-monorepo`, `tanstack-single`

This guide walks through adding a new framework (e.g. SvelteKit) with both
layouts. The same recipe minus framework-tree creation handles a new
layout for an existing framework.

## 1. Decide what's truly new

If you're adding a framework, you'll need:

- A new entry in the `Framework` enum.
- A new directory tree under `packages/templates/src/frameworks/<id>/`
  with `app/` (single-app), `monorepo/`, and `generators/` subtrees.
- New variant manifests composing existing `shared/` layers with the new
  framework layers.

If you're only adding a layout for an existing framework:

- Possibly a new entry in the `Layout` enum (the current `monorepo` and
  `single` may already cover you).
- A new subtree under the existing framework dir.
- A new variant manifest.

## 2. Update the enums in `@turbocraft/core`

Edit [`packages/core/src/schema.ts`](../../packages/core/src/schema.ts):

```ts
export const Framework = z.enum(["nextjs", "tanstack", "sveltekit"]);
```

Add the new variant id:

```ts
export const VariantId = z.enum([
  "nextjs-monorepo",
  "nextjs-single",
  "tanstack-monorepo",
  "tanstack-single",
  "sveltekit-monorepo",
  "sveltekit-single",
]);
```

Extend `variantIdFor()` to map the new framework to the right id.

## 3. Build the template tree

Mirror the existing framework structure:

```text
packages/templates/src/frameworks/sveltekit/
  app/                  Single-app source tree.
    package.json.hbs    Framework-specific deps (full version pins).
    src/...
    tsconfig.json
    ...
  monorepo/             Monorepo source tree.
    apps/web/...        Per-app source.
    package.json.hbs    Root package.json for the monorepo.
    pnpm-workspace.yaml
    turbo.json
    ...
  oxlint/               Framework-specific oxlint overrides (optional).
  generators/           Plop generators (`config.ts`, templates).
```

Reuse everything you can from `shared/base` and `shared/monorepo` —
diverging on cross-framework assets is the smell described in
[Architecture overview](../architecture/overview.md#key-invariants).

### Catalog vs pinned deps

Monorepo variants use `catalog:` refs in their `package.json.hbs` files;
single-app variants use full version pins. Match this split in any new
feature wiring you do.

## 4. Wire feature support

For each existing feature (`convex`, `better-auth`) that the new framework
should support, add a feature-specific subtree:

```text
packages/templates/src/features/convex/sveltekit/
  files/                Framework-specific files for the feature.
  deps/                 (Optional) framework-specific dep merges.
```

If the feature doesn't apply to your new framework, omit it from
`supportedFeatures` in the variant manifests.

## 5. Write the variant manifests

Create `packages/templates/src/variants/sveltekit-monorepo.ts`:

```ts
import type { TemplateManifest } from "@turbocraft/core";

export const manifest: TemplateManifest = {
  id: "sveltekit-monorepo",
  layers: [
    { from: "shared/monorepo", to: "." },
    { from: "frameworks/sveltekit/monorepo", to: "." },
  ],
  featureLayers: {
    convex: [
      { from: "features/convex/files", to: "apps/web" },
      { from: "features/convex/deps/monorepo", to: "apps/web" },
      { from: "features/convex/sveltekit/files", to: "apps/web" },
    ],
  },
  generators: {
    source: "frameworks/sveltekit/generators",
    destination: "turbo/generators",
  },
  initialGenerators: [],
  supportedFeatures: ["convex"],
};
```

Repeat for `sveltekit-single.ts`.

## 6. Register the variants

Edit [`packages/templates/src/index.ts`](../../packages/templates/src/index.ts):

```ts
import { manifest as sveltekitMonorepo } from "./variants/sveltekit-monorepo.ts";
import { manifest as sveltekitSingle } from "./variants/sveltekit-single.ts";

export const manifest: ManifestRegistry = {
  "nextjs-monorepo": nextjsMonorepoManifest,
  "tanstack-monorepo": tanstackMonorepoManifest,
  "nextjs-single": nextjsSingleManifest,
  "tanstack-single": tanstackSingleManifest,
  "sveltekit-monorepo": sveltekitMonorepo,
  "sveltekit-single": sveltekitSingle,
};
```

## 7. Add a test case

Extend [`apps/cli/test/scaffold.test.ts`](../../apps/cli/test/scaffold.test.ts)
with cases for each new variant. The existing tests cover the pattern:
scaffold into a temp dir, assert key files exist, then clean up.

## 8. Wizard prompts

If you added a framework, the wizard's framework prompt
([`apps/cli/src/flow/wizard.ts`](../../apps/cli/src/flow/wizard.ts)) needs a
new option. Match the label/value style of the existing entries.

## 9. Update docs

- Add the new variants to [Variants](../guides/variants.md).
- If the framework adds a runtime dependency to the _scaffolded_ project,
  call it out in [Getting started](../guides/getting-started.md).

## 10. Smoke + ship

```bash
pnpm typecheck && pnpm test && pnpm build
rm -rf /tmp/sk-test
pnpm dlx . create /tmp/sk-test --framework sveltekit --layout monorepo \
  --no-install --no-git
```

Add a changeset (`pnpm changeset`) describing the new variant. See
[Release process](release-process.md).
