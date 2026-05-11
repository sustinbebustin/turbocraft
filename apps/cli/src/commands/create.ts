import { defineCommand } from "citty";
import { Effect, Layer, Cause } from "effect";
import { resolve } from "node:path";
import { spinner } from "@clack/prompts";
import {
  Framework,
  Layout,
  Feature,
  PackageManager,
  type Feature as FeatureT,
} from "@turbocraft/core";
import { showIntro, showOutro } from "../flow/intro.ts";
import { runWizard } from "../flow/wizard.ts";
import { scaffold } from "../operations/scaffold.ts";
import { FileSystemLive } from "../services/FileSystem.ts";
import { PlopLive } from "../services/Plop.ts";
import { PackageManagerLive } from "../services/PackageManager.ts";
import { ProcessLive } from "../services/Process.ts";
import { TemplatesLive } from "../services/Templates.ts";
import { theme } from "../ui/theme.ts";

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
    force: {
      type: "boolean",
      description: "Allow scaffolding into a non-empty directory",
    },
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
        force: args.force === true,
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
      return { config, report };
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
      if (
        failure._tag === "Some" &&
        failure.value._tag === "UserCancelled"
      ) {
        // clack already printed "Cancelled."; exit quietly.
        process.exit(1);
      }
      const pretty = Cause.pretty(exit.cause);
      console.error(theme.err(pretty));
      process.exit(1);
    }

    const { config, report } = exit.value;
    const rel = resolve(config.targetDir);
    showOutro(
      [
        `Created ${theme.code(rel)} (${theme.accent(report.variant)}).`,
        report.installed
          ? `Dependencies installed via ${config.packageManager}.`
          : `Run ${theme.code(config.packageManager + " install")} when ready.`,
        report.gitInitialised ? "Git initialised." : "Skipped git init.",
        ``,
        `Next:`,
        `  cd ${rel}`,
        report.installed
          ? `  ${config.packageManager} dev`
          : `  ${config.packageManager} install && ${config.packageManager} dev`,
      ].join("\n")
    );
  },
});
