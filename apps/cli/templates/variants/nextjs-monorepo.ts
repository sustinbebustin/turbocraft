import type { TemplateManifest } from "@turbocraft/core";

/**
 * Turborepo monorepo with a Next.js app at `apps/web`. Shared workspaces:
 * `packages/shared`, `packages/typescript-config`. The shadcn feature installs
 * components into `apps/web/components/ui/` via `shadcn init` post-install.
 */
export const manifest: TemplateManifest = {
  id: "nextjs-monorepo",
  layers: [
    { from: "shared/monorepo", to: "." },
    { from: "frameworks/nextjs/monorepo", to: "." },
  ],
  featureLayers: {
    shadcn: [
      { from: "features/shadcn/deps/monorepo-app", to: "apps/web" },
      { from: "features/shadcn/nextjs/files", to: "apps/web" },
    ],
    convex: [
      { from: "features/convex/files", to: "apps/web" },
      { from: "features/convex/deps/monorepo", to: "apps/web" },
      { from: "features/convex/nextjs/files", to: "apps/web" },
    ],
    "better-auth": [
      { from: "features/better-auth/deps/monorepo", to: "apps/web" },
      { from: "features/better-auth/nextjs/files", to: "apps/web" },
    ],
  },
  generators: {
    source: "frameworks/nextjs/generators",
    destination: "turbo/generators",
  },
  initialGenerators: [],
  supportedFeatures: ["shadcn", "convex", "better-auth"],
};
