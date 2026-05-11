#!/usr/bin/env node
/**
 * `npm create turbocraft@latest <args>` resolves to this binary, which simply
 * forwards to `turbocraft create <args>` so users get one consistent CLI
 * regardless of how they invoke it.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);

const findTurbocraftBin = () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // 1. Same workspace (dev), via `apps/cli/dist/bin.mjs`.
  const monorepo = resolve(here, "..", "..", "cli", "dist", "bin.mjs");
  try {
    require("node:fs").statSync(monorepo);
    return monorepo;
  } catch {
    // ignore
  }
  // 2. Installed alongside as a dependency.
  const installed = require.resolve("turbocraft/dist/bin.mjs");
  return installed;
};

const bin = findTurbocraftBin();
const args = process.argv.slice(2);
const child = spawn(process.execPath, [bin, "create", ...args], {
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
