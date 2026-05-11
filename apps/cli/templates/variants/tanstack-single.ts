import type { TemplateManifest } from "@turbocraft/core";

/**
 * Single-app TanStack Start project. No turborepo workspace; the TanStack
 * Start app lives at the project root.
 */
export const manifest: TemplateManifest = {
  id: "tanstack-single",
  layers: [
    { from: "shared/base", to: "." },
    { from: "frameworks/tanstack/app", to: "." },
  ],
  featureLayers: {
    shadcn: [
      { from: "features/shadcn/deps/single", to: "." },
      { from: "features/shadcn/tanstack/files", to: "." },
    ],
    convex: [
      { from: "features/convex/files", to: "." },
      { from: "features/convex/deps/single", to: "." },
      { from: "features/convex/tanstack/deps/single", to: "." },
      { from: "features/convex/tanstack/files", to: "." },
    ],
    "better-auth": [
      { from: "features/better-auth/deps/single", to: "." },
      { from: "features/better-auth/tanstack/files", to: "." },
    ],
  },
  // No `generators` block — single-app projects aren't turborepos.
  initialGenerators: [],
  supportedFeatures: ["shadcn", "convex", "better-auth"],
};
