import type { TemplateManifest } from "@turbocraft/core";

/**
 * Turborepo monorepo with a TanStack Start app at `apps/web`. Shared
 * workspaces: `packages/shared`, `packages/typescript-config`. The shadcn
 * feature adds a `packages/ui` workspace skeleton that `shadcn init` populates.
 */
export const manifest: TemplateManifest = {
  id: "tanstack-monorepo",
  layers: [
    { from: "shared/monorepo", to: "." },
    { from: "frameworks/tanstack/monorepo", to: "." },
  ],
  featureLayers: {
    shadcn: [
      { from: "features/shadcn/monorepo/shared", to: "." },
      { from: "features/shadcn/deps/monorepo-app", to: "apps/web" },
      { from: "features/shadcn/tanstack/files", to: "apps/web" },
    ],
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
  supportedFeatures: ["shadcn", "convex", "better-auth"],
};
