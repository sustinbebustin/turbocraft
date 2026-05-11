import type { TemplateManifest } from "@turbocraft/core";

/**
 * Single-app Next.js project. No turborepo workspace; the Next.js app lives
 * at the project root.
 */
export const manifest: TemplateManifest = {
  id: "nextjs-single",
  layers: [
    { from: "shared/base", to: "." },
    { from: "frameworks/nextjs/app", to: "." },
  ],
  featureLayers: {
    convex: [
      { from: "features/convex/files", to: "." },
      { from: "features/convex/deps/single", to: "." },
      { from: "features/convex/nextjs/files", to: "." },
    ],
    "better-auth": [
      { from: "features/better-auth/deps/single", to: "." },
      { from: "features/better-auth/nextjs/files", to: "." },
    ],
  },
  // No `generators` block — single-app projects aren't turborepos.
  initialGenerators: [],
  supportedFeatures: ["convex", "better-auth"],
};
