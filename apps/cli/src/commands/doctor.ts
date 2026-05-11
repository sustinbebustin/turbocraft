import { defineCommand } from "citty";
import { Effect } from "effect";
import { resolve } from "node:path";
import { FileSystemService } from "../services/FileSystem.ts";
import { MainLive } from "../services/Live.ts";
import { theme } from "../ui/theme.ts";

type Check = { readonly label: string; readonly ok: boolean };

const detectLayout = (
  fs: FileSystemService["Type"]
): ((cwd: string) => Effect.Effect<"monorepo" | "single" | "unknown">) =>
  (cwd) =>
    Effect.gen(function* () {
      if (yield* fs.exists(`${cwd}/pnpm-workspace.yaml`)) return "monorepo";
      if (yield* fs.exists(`${cwd}/package.json`)) return "single";
      return "unknown";
    });

const checkExists = (
  fs: FileSystemService["Type"],
  cwd: string,
  label: string
): Effect.Effect<Check> =>
  fs.exists(`${cwd}/${label}`).pipe(Effect.map((ok) => ({ label, ok })));

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Sanity check a turbocraft-generated project.",
  },
  args: {
    cwd: { type: "string", description: "Project root (default: cwd)" },
  },
  async run({ args }) {
    const cwd = resolve(
      typeof args.cwd === "string" ? args.cwd : process.cwd()
    );

    const program = Effect.gen(function* () {
      const fs = yield* FileSystemService;
      const layout = yield* detectLayout(fs)(cwd);

      if (layout === "unknown") {
        console.error(
          theme.err(`No package.json at ${cwd}. Not a turbocraft project.`)
        );
        process.exitCode = 1;
        return;
      }

      const baseLabels = ["package.json", "tsconfig.json", ".oxlintrc.json"];
      const monorepoLabels =
        layout === "monorepo"
          ? [
              "turbo.json",
              "pnpm-workspace.yaml",
              "turbo/generators/config.ts",
              "apps",
              "packages",
            ]
          : [];

      const checks: ReadonlyArray<Check> = yield* Effect.all(
        [...baseLabels, ...monorepoLabels].map((label) =>
          checkExists(fs, cwd, label)
        )
      );

      console.log(theme.muted(`Detected layout: ${layout}`));
      for (const c of checks) {
        const tag = c.ok ? theme.ok("[OK]") : theme.err("[MISSING]");
        console.log(`${tag} ${c.label}`);
      }

      const allOk = checks.every((c) => c.ok);
      if (!allOk) {
        console.error(theme.err("\nOne or more required files are missing."));
        process.exitCode = 1;
        return;
      }
      console.log(theme.ok("\nProject looks healthy."));
    }).pipe(Effect.provide(MainLive));

    await Effect.runPromise(program);
  },
});
