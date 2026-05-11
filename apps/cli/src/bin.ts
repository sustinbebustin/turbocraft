#!/usr/bin/env node
import { run } from "./main.ts";

run().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exitCode = 1;
});
