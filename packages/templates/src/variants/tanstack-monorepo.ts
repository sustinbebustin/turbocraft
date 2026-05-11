import type { TemplateManifest } from "@turbocraft/core";

/**
 * Turborepo monorepo with a TanStack Start app at `apps/web`. Shared
 * workspaces: `packages/ui`, `packages/shared`, `packages/typescript-config`.
 */
export const manifest: TemplateManifest = {
  id: "tanstack-monorepo",
  layers: [
    { from: "shared/monorepo", to: "." },
    { from: "frameworks/tanstack/monorepo", to: "." },
  ],
  featureLayers: {
    convex: [
      { from: "features/convex/files", to: "apps/web" },
      { from: "features/convex/deps/monorepo", to: "apps/web" },
      { from: "features/convex/tanstack/deps/monorepo", to: "apps/web" },
      { from: "features/convex/tanstack/files", to: "apps/web" },
    ],
    "better-auth": [
      { from: "features/better-auth/deps/monorepo", to: "apps/web" },
      { from: "features/better-auth/tanstack/files", to: "apps/web" },
    ],
  },
  generators: {
    source: "frameworks/tanstack/generators",
    destination: "turbo/generators",
  },
  initialGenerators: [],
  supportedFeatures: ["convex", "better-auth"],
};
