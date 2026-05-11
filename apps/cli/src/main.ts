import { defineCommand, runMain } from "citty";
import { createCommand } from "./commands/create.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { addCommand } from "./commands/add.ts";

const SUBCOMMANDS = new Set(["create", "add", "doctor"]);

const main = defineCommand({
  meta: {
    name: "turbocraft",
    version: "0.0.1",
    description:
      "Scaffold full-stack monorepo templates (Next.js / TanStack Start).",
  },
  subCommands: {
    create: createCommand,
    add: addCommand,
    doctor: doctorCommand,
  },
});

/**
 * Rewrite argv so `turbocraft my-app` and `turbocraft --framework nextjs`
 * both default to the `create` subcommand. We only inject when the first
 * non-flag token is not a known subcommand and is not a help/version flag.
 */
const normaliseArgv = (argv: ReadonlyArray<string>): Array<string> => {
  const first = argv[0];
  if (first === undefined) return [...argv];
  if (SUBCOMMANDS.has(first)) return [...argv];
  if (
    first === "-h" ||
    first === "--help" ||
    first === "-v" ||
    first === "--version"
  ) {
    return [...argv];
  }
  return ["create", ...argv];
};

export const run = (): Promise<void> => {
  process.argv = [
    ...process.argv.slice(0, 2),
    ...normaliseArgv(process.argv.slice(2)),
  ];
  return runMain(main);
};
