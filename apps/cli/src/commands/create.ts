import { defineCommand } from "citty";
import { Effect, Layer, Cause } from "effect";
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
import { FileSystemLive } from "../services/FileSystem.ts";
import { PlopLive } from "../services/Plop.ts";
import { PackageManagerLive } from "../services/PackageManager.ts";
import { ProcessLive } from "../services/Process.ts";
import { ShadcnRegistryLive } from "../services/ShadcnRegistry.ts";
import { TemplatesLive } from "../services/Templates.ts";
import { theme } from "../ui/theme.ts";

const formatTargetDirNotEmpty = (
  path: string,
  conflicts: ReadonlyArray<string>
): string => {
  const header = `Target directory ${theme.code(path)} is not empty.`;
  const list = conflicts.map((name) => `  ${name}`).join("\n");
  const hint =
    `Pick a different project name, or remove the existing directory:\n` +
    `  ${theme.code(`rm -rf ${path}`)}`;
  return [theme.err(header), list, "", hint].join("\n");
};

const parseFeatures = (raw: string | undefined): ReadonlyArray<FeatureT> => {
  if (raw === undefined || raw.length === 0) return [];
  const valid = Feature.options;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parsed = Feature.safeParse(s);
      if (!parsed.success) {
        throw new Error(
          `Unknown feature '${s}'. Valid features: ${valid.join(", ")}.`
        );
      }
      return parsed.data;
    });
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
    const framework = args.framework
      ? Framework.parse(args.framework)
      : undefined;
    const layout = args.layout ? Layout.parse(args.layout) : undefined;
    const features = parseFeatures(args.features);
    const pm = args.pm ? PackageManager.parse(args.pm) : undefined;

    // Validate the positional name eagerly so the user doesn't click through
    // the entire wizard before learning their name is malformed (e.g. they
    // passed a path like `/tmp/foo` instead of a kebab-case slug).
    const nameInput = typeof args.name === "string" ? args.name : undefined;
    if (nameInput !== undefined) {
      const parsed = ProjectName.safeParse(nameInput);
      if (!parsed.success) {
        const issue =
          parsed.error.issues[0]?.message ?? "Invalid project name.";
        console.error(
          theme.err(
            `Invalid project name ${theme.code(nameInput)}: ${issue}\n` +
              `Pass a kebab-case slug (e.g. ${theme.code("my-app")}). ` +
              `The project will be created at ${theme.code("<cwd>/<name>")}.`
          )
        );
        process.exit(1);
      }
    }

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

      // Setup runs only when install ran AND the relevant feature is on;
      // otherwise we return a no-op report. Stdio inherits to the user's
      // terminal so prompts (Convex login URL, shadcn confirm) print normally.
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

      return { config, report, convex, shadcn };
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          FileSystemLive,
          PackageManagerLive.pipe(Layer.provide(ProcessLive)),
          ProcessLive,
          PlopLive,
          ShadcnRegistryLive,
          TemplatesLive
        )
      )
    );

    const exit = await Effect.runPromiseExit(program);
    if (exit._tag === "Failure") {
      const failure = Cause.failureOption(exit.cause);
      if (failure._tag === "Some") {
        const err = failure.value;
        if (err._tag === "UserCancelled") {
          // clack already printed "Cancelled."; exit quietly.
          process.exit(1);
        }
        if (err._tag === "TargetDirNotEmpty") {
          console.error(formatTargetDirNotEmpty(err.path, err.conflicts));
          process.exit(1);
        }
        if (err._tag === "InvalidConfig") {
          console.error(theme.err("Invalid configuration:"));
          for (const issue of err.issues) {
            console.error(theme.err(`  - ${issue}`));
          }
          process.exit(1);
        }
      }
      const pretty = Cause.pretty(exit.cause);
      console.error(theme.err(pretty));
      process.exit(1);
    }

    const { config, report, convex, shadcn } = exit.value;
    showOutro(composeOutro(config, report, convex, shadcn));
  },
});
