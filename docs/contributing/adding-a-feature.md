# Adding a feature

A _feature_ is an opt-in layer applied after a variant's base layers. The
repo currently ships two:

- `convex` — Convex backend wiring.
- `better-auth` — Better Auth (requires `convex`).

This guide adds a hypothetical `drizzle` feature. Substitute your feature
name throughout.

## 1. Decide compatibility

Two questions to answer upfront:

- Which variants should support this feature? (List of variant ids.)
- Does it require other features? (e.g. better-auth requires convex.)

If the answer to "which variants" is "all of them," you don't need
per-framework subtrees — a single `files/` is enough. Otherwise you'll
need framework-specific subtrees.

## 2. Extend the `Feature` enum

Edit [`packages/core/src/schema.ts`](../../packages/core/src/schema.ts):

```ts
export const Feature = z.enum(["convex", "better-auth", "drizzle"]);
```

If your feature requires another, encode the rule in the `ProjectConfig`
refinement at the bottom of that file:

```ts
.refine(
  (cfg) => !cfg.features.includes("drizzle") || cfg.features.includes("convex"),
  { message: "Drizzle requires Convex.", path: ["features"] }
)
```

(Compatibility is also declared in the templates layer — see step 4. The
schema-level refinement is the redundant safety net at the CLI boundary.)

## 3. Build the feature tree

```text
packages/templates/src/features/drizzle/
  compatibility.ts        # { requires: Feature[] }
  files/                  # always-at-root assets (e.g. drizzle/ config dir)
  deps/
    single/               # dep merges for single-app variants
      package.json.merge.json
    monorepo/             # dep merges for monorepo variants
      package.json.merge.json
  nextjs/
    files/                # Next.js-specific feature files
    deps/                 # (optional) Next.js-specific dep merges
  tanstack/
    files/
    deps/
```

The split between `single/` and `monorepo/` under `deps/` mirrors the
catalog-vs-pinned convention: monorepo variants use `catalog:` refs;
single-app variants use full version pins.

### `package.json.merge.json` example

```jsonc
{
  "dependencies": {
    "drizzle-orm": "catalog:",
  },
  "devDependencies": {
    "drizzle-kit": "catalog:",
  },
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
  },
}
```

The seed pipeline deep-merges this into the existing `package.json`
emitted by base layers. See
[Templates system](../architecture/templates-system.md#deep-merge-rules)
for merge semantics.

## 4. Declare compatibility

```ts
// packages/templates/src/features/drizzle/compatibility.ts
import type { FeatureCompatibility } from "@turbocraft/core";

export const compatibility: FeatureCompatibility = {
  requires: ["convex"], // or [] if standalone
};
```

This is the _primary_ source of truth for inter-feature deps. The wizard
loads it via `loadCompatibility()` and prevents inconsistent combinations
without any CLI code changes.

## 5. Register the feature

Edit [`packages/templates/src/index.ts`](../../packages/templates/src/index.ts):

```ts
import { compatibility as drizzleCompatibility } from "./features/drizzle/compatibility.ts";

const compatibility: Readonly<Record<Feature, FeatureCompatibility>> = {
  convex: convexCompatibility,
  "better-auth": betterAuthCompatibility,
  drizzle: drizzleCompatibility,
};
```

## 6. Wire feature layers into variants

For each variant that should support the feature, add a `featureLayers`
entry and list the feature in `supportedFeatures`:

```ts
// packages/templates/src/variants/nextjs-monorepo.ts
featureLayers: {
  // ...existing entries...
  drizzle: [
    { from: "features/drizzle/files",          to: "apps/web" },
    { from: "features/drizzle/deps/monorepo",  to: "apps/web" },
    { from: "features/drizzle/nextjs/files",   to: "apps/web" },
  ],
},
supportedFeatures: ["convex", "better-auth", "drizzle"],
```

Repeat per variant. **Don't** add the feature to a variant's
`supportedFeatures` without providing the matching `featureLayers` — the
CLI will accept the flag but the feature layers will silently no-op.

## 7. Catalog entries

If your feature pulls in new packages via `catalog:` refs, add them to the
catalog inside each affected monorepo template's `pnpm-workspace.yaml.hbs`
(under `packages/templates/src/frameworks/<fw>/monorepo/`). Single-app
variants take pinned versions in their respective `package.json.merge.json`
files under `deps/single/`.

## 8. Add a test case

Extend [`apps/cli/test/scaffold.test.ts`](../../apps/cli/test/scaffold.test.ts):

```ts
test("scaffolds nextjs-monorepo with drizzle", async () => {
  await scaffoldTo(tmpDir, {
    framework: "nextjs",
    layout: "monorepo",
    features: ["convex", "drizzle"],
  });
  expect(existsSync(join(tmpDir, "apps/web/drizzle.config.ts"))).toBe(true);
});
```

## 9. Update docs

- Add the feature to [Variants and features](../guides/variants.md).
- If the feature has user-visible setup steps post-scaffold, mention them
  in the variant's `README.md.hbs` so they end up in the generated project.

## 10. Smoke + ship

```bash
pnpm typecheck && pnpm test && pnpm build
rm -rf /tmp/dz-test
node apps/cli/dist/bin.mjs create /tmp/dz-test \
  --framework nextjs --layout monorepo \
  --features convex,drizzle \
  --no-install --no-git
ls /tmp/dz-test/apps/web/drizzle*    # sanity check the feature landed
```

Add a changeset describing the new feature. See
[Release process](release-process.md).
