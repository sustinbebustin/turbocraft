import type { TemplateManifest } from "@turbocraft/core";

/**
 * Turborepo monorepo with a Next.js app at `apps/web`. Shared workspaces:
 * `packages/ui` (shadcn components), `packages/shared`, `packages/typescript-config`.
 */
export const manifest: TemplateManifest = {
  id: "nextjs-monorepo",
  layers: [
    { from: "shared/monorepo", to: "." },
    { from: "frameworks/nextjs/monorepo", to: "." },
  ],
  featureLayers: {
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
  supportedFeatures: ["convex", "better-auth"],
};
