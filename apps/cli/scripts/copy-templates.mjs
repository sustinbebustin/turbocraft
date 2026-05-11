#!/usr/bin/env node
/**
 * Build-time helper. After tsdown emits `dist/bin.js`, this script copies the
 * `@turbocraft/templates` source assets next to the CLI bundle so the
 * published package is self-contained.
 *
 *  apps/cli/dist/bin.js
 *  apps/cli/templates/...   (mirror of packages/templates/src/...)
 */
import { mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = resolve(here, "..");
const templatesSrc = resolve(
  cliRoot,
  "..",
  "..",
  "packages",
  "templates",
  "src"
);
const templatesDst = resolve(cliRoot, "templates");

if (!existsSync(templatesSrc)) {
  console.error(`Templates source not found at ${templatesSrc}`);
  process.exit(1);
}

await rm(templatesDst, { recursive: true, force: true });
await mkdir(templatesDst, { recursive: true });
await cp(templatesSrc, templatesDst, {
  recursive: true,
  filter: (src) =>
    !src.includes("/node_modules") &&
    !src.endsWith(".test.ts") &&
    !src.endsWith(".tsbuildinfo"),
});
console.log(`turbocraft: copied templates -> ${templatesDst}`);
