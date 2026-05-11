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
});
