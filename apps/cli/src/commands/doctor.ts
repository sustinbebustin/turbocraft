import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { theme } from "../ui/theme.ts";

type Check = { readonly label: string; readonly ok: boolean };

const detectLayout = (cwd: string): "monorepo" | "single" | "unknown" => {
  if (existsSync(`${cwd}/pnpm-workspace.yaml`)) return "monorepo";
  if (existsSync(`${cwd}/package.json`)) return "single";
  return "unknown";
};

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
    const layout = detectLayout(cwd);

    if (layout === "unknown") {
      console.error(
        theme.err(`No package.json at ${cwd}. Not a turbocraft project.`)
      );
      process.exit(1);
    }

    const baseChecks: ReadonlyArray<Check> = [
      { label: "package.json", ok: existsSync(`${cwd}/package.json`) },
      { label: "tsconfig.json", ok: existsSync(`${cwd}/tsconfig.json`) },
      { label: ".oxlintrc.json", ok: existsSync(`${cwd}/.oxlintrc.json`) },
    ];

    const monorepoChecks: ReadonlyArray<Check> =
      layout === "monorepo"
        ? [
            { label: "turbo.json", ok: existsSync(`${cwd}/turbo.json`) },
            {
              label: "pnpm-workspace.yaml",
              ok: existsSync(`${cwd}/pnpm-workspace.yaml`),
            },
            {
              label: "turbo/generators/config.ts",
              ok: existsSync(`${cwd}/turbo/generators/config.ts`),
            },
            { label: "apps/", ok: existsSync(`${cwd}/apps`) },
            { label: "packages/", ok: existsSync(`${cwd}/packages`) },
          ]
        : [];

    console.log(theme.muted(`Detected layout: ${layout}`));
    const checks = [...baseChecks, ...monorepoChecks];
    for (const c of checks) {
      const tag = c.ok ? theme.ok("[OK]") : theme.err("[MISSING]");
      console.log(`${tag} ${c.label}`);
    }

    const allOk = checks.every((c) => c.ok);
    if (!allOk) {
      console.error(theme.err("\nOne or more required files are missing."));
      process.exit(1);
    }
    console.log(theme.ok("\nProject looks healthy."));
  },
});
