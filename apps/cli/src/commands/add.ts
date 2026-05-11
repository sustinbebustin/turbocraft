import { defineCommand } from "citty";
import { Effect } from "effect";
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";
import { FileSystemService } from "../services/FileSystem.ts";
import { ProcessService } from "../services/Process.ts";
import { MainLive } from "../services/Live.ts";
import { theme } from "../ui/theme.ts";

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

    const program = Effect.gen(function* () {
      const fs = yield* FileSystemService;
      const proc = yield* ProcessService;

      const hasGenerators = yield* fs.exists(
        `${cwd}/turbo/generators/config.ts`
      );
      if (!hasGenerators) {
        console.error(
          theme.err(
            `No turbo/generators/config.ts found in ${cwd}. Run from a turbocraft project root.`
          )
        );
        process.exitCode = 1;
        return;
      }

      const pm = detectPackageManager(cwd);
      yield* proc.run(pm, ["turbo", "gen", "run", String(args.kind)], {
        cwd,
        interactive: true,
      });
    }).pipe(Effect.provide(MainLive));

    await Effect.runPromise(program).catch(() => {
      process.exitCode = 1;
    });
  },
});
