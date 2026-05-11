import { defineCommand } from "citty";
import { Effect, Layer, Cause } from "effect";
import { resolve } from "node:path";
import { spinner, log } from "@clack/prompts";
import {
  Framework,
  Layout,
  Feature,
  PackageManager,
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
import { FileSystemLive } from "../services/FileSystem.ts";
import { PlopLive } from "../services/Plop.ts";
import { PackageManagerLive } from "../services/PackageManager.ts";
import { ProcessLive } from "../services/Process.ts";
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

const NO_CONVEX_SETUP: ConvexSetupReport = {
  convexConfigured: false,
  betterAuthSecretSet: false,
  siteUrlWritten: false,
};

const fallbackSteps = (
  config: ProjectConfig,
  convex: ConvexSetupReport
): ReadonlyArray<string> => {
  const wantsConvex = config.features.includes("convex");
  const wantsBA = config.features.includes("better-auth");
  if (!wantsConvex) return [];

  const isMonorepo = config.layout === "monorepo";
  const envDir = isMonorepo ? "apps/web/" : "";
  const devConvex = isMonorepo
    ? `${config.packageManager} --filter web dev:convex`
    : `${config.packageManager} dev:convex`;
  const lines: Array<string> = [];

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
  return lines;
};

const composeOutro = (
  config: ProjectConfig,
  report: ScaffoldReport,
  convex: ConvexSetupReport
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

  lines.push("", "Next:");
  lines.push(`  cd ${rel}`);

  const fallback = fallbackSteps(config, convex);
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
      description: "Comma-separated: convex,better-auth",
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

    const program = Effect.gen(function* () {
      const config = yield* runWizard({
        cwd,
        name: typeof args.name === "string" ? args.name : undefined,
        framework,
        layout,
        features: args.features !== undefined ? features : undefined,
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

      // Setup runs only when install ran AND convex is selected; otherwise
      // it returns a no-op report. Stdio inherits to the user's terminal
      // so the Convex browser-login URL prints normally.
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

      return { config, report, convex };
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          FileSystemLive,
          PackageManagerLive.pipe(Layer.provide(ProcessLive)),
          ProcessLive,
          PlopLive,
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
      }
      const pretty = Cause.pretty(exit.cause);
      console.error(theme.err(pretty));
      process.exit(1);
    }

    const { config, report, convex } = exit.value;
    showOutro(composeOutro(config, report, convex));
  },
});
