import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  dts: false,
  clean: true,
  sourcemap: true,
  shims: false,
  deps: {
    neverBundle: [
      "node-plop",
      "@clack/prompts",
      "citty",
      "effect",
      "@effect/platform",
      "@effect/platform-node",
      "handlebars",
      "picocolors",
      "tinyexec",
      "tinyglobby",
      "zod",
    ],
  },
});
