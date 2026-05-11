import { defineCommand } from "citty";
import { x } from "tinyexec";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { theme } from "../ui/theme.ts";

/**
 * Inside a turbocraft-generated repo, `turbocraft add app|page` is a thin
 * wrapper over the locally-shipped `turbo gen run <kind>` so users only need to
 * learn one verb. Generators live at `turbo/generators/` in the output.
 */

/**
 * Best-effort: read `packageManager` from the project's `package.json` and
 * return its binary name. Defaults to `pnpm` when unset or unrecognised.
 */
const detectPackageManager = (cwd: string): string => {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      packageManager?: string;
    };
    const spec = pkg.packageManager;
    if (typeof spec === "string") {
      const name = spec.split("@", 1)[0];
      if (
        name === "pnpm" ||
        name === "npm" ||
        name === "bun" ||
        name === "yarn"
      ) {
        return name;
      }
    }
  } catch {
    // fall through to default
  }
  return "pnpm";
};

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Run a generator inside an existing turbocraft project.",
  },
  args: {
    kind: {
      type: "positional",
      required: true,
      description: "Generator name (app | page | ...)",
    },
    cwd: { type: "string", description: "Project root (default: cwd)" },
  },
  async run({ args }) {
    const cwd = resolve(
      typeof args.cwd === "string" ? args.cwd : process.cwd()
    );
    if (!existsSync(`${cwd}/turbo/generators/config.ts`)) {
      console.error(
        theme.err(
          `No turbo/generators/config.ts found in ${cwd}. Run from a turbocraft project root.`
        )
      );
      process.exit(1);
    }
    const pm = detectPackageManager(cwd);
    const result = await x(pm, ["turbo", "gen", "run", String(args.kind)], {
      nodeOptions: { cwd, stdio: "inherit" },
    });
    if (result.exitCode !== 0) {
      process.exit(result.exitCode ?? 1);
    }
  },
});
