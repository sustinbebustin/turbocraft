import { defineCommand } from "citty";
import { Effect } from "effect";
import { resolve } from "node:path";
import { spinner, log } from "@clack/prompts";
import {
  Framework,
  Layout,
  Feature,
  PackageManager,
  ProjectName,
  SHADCN_ALL_COMPONENTS,
  type Feature as FeatureT,
  type ProjectConfig,
} from "@turbocraft/core";
import { showIntro, showOutro } from "../flow/intro.ts";
import { runWizard } from "../flow/wizard.ts";
import { scaffold, type ScaffoldReport } from "../operations/scaffold.ts";
import {
  setupConvex,
  type ConvexSetupReport,
} from "../operations/setup-convex.ts";
import {
  setupShadcn,
  type ShadcnSetupReport,
} from "../operations/setup-shadcn.ts";
import { InvalidConfig } from "../domain/errors.ts";
import { MainLive } from "../services/Live.ts";
import { runCli } from "../runtime/run.ts";
import { theme } from "../ui/theme.ts";

const parseFeatures = (
  raw: string | undefined
): Effect.Effect<ReadonlyArray<FeatureT>, InvalidConfig> => {
  if (raw === undefined || raw.length === 0) return Effect.succeed([]);
  const valid = Feature.options;
  const issues: Array<string> = [];
  const result: Array<FeatureT> = [];
  for (const s of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
    const parsed = Feature.safeParse(s);
    if (!parsed.success) {
      issues.push(`Unknown feature '${s}'. Valid features: ${valid.join(", ")}.`);
    } else {
      result.push(parsed.data);
    }
  }
  if (issues.length > 0) return Effect.fail(new InvalidConfig({ issues }));
  return Effect.succeed(result);
};

// `--shadcn-components` accepts:
//   - "all"  -> install every primitive (`shadcn add --all`)
//   - "none" or "" -> init only, no components added
//   - "button,card" -> exact list (whitespace tolerated)
// Returns `undefined` when the flag is absent so the wizard can prompt.
const parseShadcnComponents = (
  raw: string | undefined
): ReadonlyArray<string> | undefined => {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "none") return [];
  if (trimmed.toLowerCase() === "all") return [SHADCN_ALL_COMPONENTS];
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const NO_CONVEX_SETUP: ConvexSetupReport = {
  convexConfigured: false,
  betterAuthSecretSet: false,
  siteUrlWritten: false,
};

const NO_SHADCN_SETUP: ShadcnSetupReport = {
  initialized: false,
  componentsAdded: [],
  addedAll: false,
};

const fallbackSteps = (
  config: ProjectConfig,
  convex: ConvexSetupReport,
  shadcn: ShadcnSetupReport
): ReadonlyArray<string> => {
  const lines: Array<string> = [];
  const wantsConvex = config.features.includes("convex");
  const wantsBA = config.features.includes("better-auth");
  const isMonorepo = config.layout === "monorepo";

  if (wantsConvex) {
    const envDir = isMonorepo ? "apps/web/" : "";
    const devConvex = isMonorepo
      ? `${config.packageManager} --filter web dev:convex`
      : `${config.packageManager} dev:convex`;

    if (!convex.convexConfigured) {
      lines.push(
        `  cp ${envDir}.env.example ${envDir}.env.local`,
        `  ${devConvex}   # interactive: log in + create deployment, then Ctrl-C`
      );
    }
    if (wantsBA && !convex.betterAuthSecretSet) {
      lines.push(
        `  npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"`
      );
    }
  }

  if (
    config.features.includes("shadcn") &&
    config.shadcn !== undefined &&
    !shadcn.initialized
  ) {
    // shadcn's `--monorepo` flag appends `packages/ui` itself, so the fallback
    // command always runs from the project root (no `cd` needed).
    const runner =
      config.packageManager === "pnpm"
        ? "pnpm dlx"
        : config.packageManager === "bun"
          ? "bunx --bun"
          : "npx";
    const tmpl = config.framework === "nextjs" ? "next" : "start";
    const monorepoFlag = isMonorepo ? " --monorepo" : "";
    lines.push(
      `  ${runner} shadcn@latest init --preset ${config.shadcn.preset} --base base --template ${tmpl} --yes${monorepoFlag}`
    );
  }

  return lines;
};

const composeOutro = (
  config: ProjectConfig,
  report: ScaffoldReport,
  convex: ConvexSetupReport,
  shadcn: ShadcnSetupReport
): string => {
  const rel = resolve(config.targetDir);
  const lines: Array<string> = [
    `Created ${theme.code(rel)} (${theme.accent(report.variant)}).`,
    report.installed
      ? `Dependencies installed via ${config.packageManager}.`
      : `Run ${theme.code(config.packageManager + " install")} when ready.`,
    report.gitInitialised ? "Git initialised." : "Skipped git init.",
  ];

  if (convex.convexConfigured) {
    lines.push(
      `Convex deployment configured${convex.betterAuthSecretSet ? " · Better Auth secret set" : ""}.`
    );
  }

  if (shadcn.initialized) {
    if (shadcn.addedAll) {
      lines.push("shadcn initialized · all components installed.");
    } else if (shadcn.componentsAdded.length > 0) {
      lines.push(
        `shadcn initialized · ${shadcn.componentsAdded.length} components installed.`
      );
    } else {
      lines.push("shadcn initialized.");
    }
  }

  lines.push("", "Next:");
  lines.push(`  cd ${rel}`);

  const fallback = fallbackSteps(config, convex, shadcn);
  if (!report.installed) {
    lines.push(`  ${config.packageManager} install`);
  }
  for (const step of fallback) lines.push(step);
  lines.push(`  ${config.packageManager} dev`);

  if (convex.skippedReason !== undefined) {
    lines.push(
      "",
      theme.muted(`(Convex setup skipped: ${convex.skippedReason})`)
    );
  }
  if (shadcn.skippedReason !== undefined) {
    lines.push(
      "",
      theme.muted(`(shadcn setup skipped: ${shadcn.skippedReason})`)
    );
  }

  return lines.join("\n");
};

export const createCommand = defineCommand({
  meta: {
    name: "create",
    description: "Scaffold a new turbocraft project.",
  },
  args: {
    name: { type: "positional", required: false, description: "Project name" },
    framework: { type: "string", description: "nextjs | tanstack" },
    layout: { type: "string", description: "monorepo | single" },
    features: {
      type: "string",
      description: "Comma-separated: shadcn,convex,better-auth",
    },
    "shadcn-preset": {
      type: "string",
      description:
        "shadcn preset code (default: built-in base-lyra/phosphor/neutral)",
    },
    "shadcn-components": {
      type: "string",
      description:
        "shadcn components: 'all', 'none', or comma-separated names (e.g. button,card)",
    },
    pm: { type: "string", description: "Package manager: pnpm | npm | bun" },
    install: {
      type: "boolean",
      description: "Install dependencies after scaffolding",
    },
    git: { type: "boolean", description: "Initialise git after scaffolding" },
  },
  async run({ args }) {
    showIntro();

    const cwd = process.cwd();
    const nameInput = typeof args.name === "string" ? args.name : undefined;
    const shadcnPresetFlag =
      typeof args["shadcn-preset"] === "string" &&
      args["shadcn-preset"].length > 0
        ? args["shadcn-preset"]
        : undefined;
    const shadcnComponentsFlag = parseShadcnComponents(
      typeof args["shadcn-components"] === "string"
        ? args["shadcn-components"]
        : undefined
    );

    const program = Effect.gen(function* () {
      // Validate CLI args inside the Effect pipeline so errors flow through runCli.
      if (nameInput !== undefined) {
        const parsed = ProjectName.safeParse(nameInput);
        if (!parsed.success) {
          const issue =
            parsed.error.issues[0]?.message ?? "Invalid project name.";
          return yield* new InvalidConfig({
            issues: [
              `Invalid project name '${nameInput}': ${issue}. ` +
                `Pass a kebab-case slug (e.g. my-app).`,
            ],
          });
        }
      }

      const framework = args.framework
        ? Framework.parse(args.framework)
        : undefined;
      const layout = args.layout ? Layout.parse(args.layout) : undefined;
      const features = yield* parseFeatures(args.features);
      const pm = args.pm ? PackageManager.parse(args.pm) : undefined;

      const config = yield* runWizard({
        cwd,
        name: nameInput,
        framework,
        layout,
        features: args.features !== undefined ? features : undefined,
        shadcnPreset: shadcnPresetFlag,
        shadcnComponents: shadcnComponentsFlag,
        packageManager: pm,
        install: typeof args.install === "boolean" ? args.install : undefined,
        git: typeof args.git === "boolean" ? args.git : undefined,
      });

      const s = spinner();
      s.start(`Scaffolding ${config.framework}-${config.layout}`);
      const report = yield* scaffold(config).pipe(
        Effect.tap(() =>
          Effect.sync(() => s.stop(theme.ok("Scaffold complete.")))
        ),
        Effect.tapErrorCause(() =>
          Effect.sync(() => s.stop(theme.err("Scaffold failed.")))
        )
      );

      const wantsShadcnSetup =
        report.installed &&
        config.features.includes("shadcn") &&
        config.shadcn !== undefined;
      let shadcn: ShadcnSetupReport = NO_SHADCN_SETUP;
      if (wantsShadcnSetup) {
        log.info("Setting up shadcn/ui (init + add).");
        shadcn = yield* setupShadcn({
          ...config,
          targetDir: report.targetDir,
        });
        if (shadcn.initialized) {
          if (shadcn.addedAll) {
            log.success("shadcn initialized · all components installed.");
          } else if (shadcn.componentsAdded.length > 0) {
            log.success(
              `shadcn initialized · added ${shadcn.componentsAdded.length} components.`
            );
          } else {
            log.success("shadcn initialized.");
          }
        } else if (shadcn.skippedReason !== undefined) {
          log.warn(`shadcn setup incomplete: ${shadcn.skippedReason}`);
        }
      }

      const wantsConvexSetup =
        report.installed && config.features.includes("convex");
      let convex: ConvexSetupReport = NO_CONVEX_SETUP;
      if (wantsConvexSetup) {
        log.info(
          "Setting up Convex deployment (may open a browser to log in)."
        );
        convex = yield* setupConvex({ ...config, targetDir: report.targetDir });
        if (convex.convexConfigured) {
          log.success(
            convex.betterAuthSecretSet
              ? "Convex configured · Better Auth secret set."
              : "Convex configured."
          );
        } else if (convex.skippedReason !== undefined) {
          log.warn(`Convex setup incomplete: ${convex.skippedReason}`);
        }
      }

      showOutro(composeOutro(config, report, convex, shadcn));
    }).pipe(Effect.provide(MainLive));

    await runCli(program);
  },
});
