import { Effect } from "effect";
import type {
  PackageManager as PackageManagerT,
  ProjectConfig,
} from "@turbocraft/core";
import { SHADCN_ALL_COMPONENTS } from "@turbocraft/core";
import { ProcessService } from "../services/Process.ts";

export type ShadcnSetupReport = {
  /** True when `shadcn init` completed and wrote components.json. */
  readonly initialized: boolean;
  /** Components actually passed to `shadcn add` (after deduping). Empty when init-only. */
  readonly componentsAdded: ReadonlyArray<string>;
  /** True when --all was passed to `shadcn add` (componentsAdded is also empty in that case). */
  readonly addedAll: boolean;
  /**
   * Short reason for the outro to surface alongside fallback commands when
   * any step failed. Absent on full success.
   */
  readonly skippedReason?: string;
};

const SKIPPED_NOT_REQUESTED: ShadcnSetupReport = {
  initialized: false,
  componentsAdded: [],
  addedAll: false,
};

// Components that the bundled templates import directly. If the user opts in
// to shadcn we have to make sure these exist or the project won't compile.
// `sonner` is the Toaster used by every layout. `button` is only used by the
// monorepo `apps/web` landing page; single-app pages gate the Button on the
// `withShadcn` Handlebars conditional.
const TEMPLATE_REQUIRED = ["sonner"] as const;
const TEMPLATE_REQUIRED_MONOREPO = ["sonner", "button"] as const;
// Extras that better-auth's pre-built sign-in / sign-up / reset-password
// pages depend on.
const BETTER_AUTH_REQUIRED = [
  "button",
  "card",
  "input",
  "label",
  "separator",
] as const;

type Runner = {
  readonly bin: string;
  readonly prefix: ReadonlyArray<string>;
};

const runnerFor = (pm: PackageManagerT): Runner => {
  switch (pm) {
    case "pnpm":
      return { bin: "pnpm", prefix: ["dlx", "shadcn@latest"] };
    case "npm":
      return { bin: "npx", prefix: ["shadcn@latest"] };
    case "bun":
      return { bin: "bunx", prefix: ["--bun", "shadcn@latest"] };
  }
};

// The `init --template` flag wants the framework key. `next` for Next.js,
// `start` for TanStack Start.
const templateFor = (framework: ProjectConfig["framework"]): string =>
  framework === "nextjs" ? "next" : "start";

// shadcn's `--monorepo` flag is meant to be run from the repo root — shadcn
// itself appends `packages/ui` to write components.json + populate the UI
// workspace. Running from `packages/ui` produced the path-doubled
// `packages/ui/packages/ui/components.json` error.
// For single-app variants `init` and `add` both run at the project root.
const shadcnCwdFor = (config: ProjectConfig): string => config.targetDir;

const dedupe = (xs: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (x.length === 0 || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
};

/**
 * Post-install setup for shadcn:
 *   1. `<runner> shadcn@latest init --preset <code> --base base --template <next|start> --yes [--monorepo]`
 *   2. `<runner> shadcn@latest add --yes <components>` (or `--all` when
 *      `config.shadcn.components === [SHADCN_ALL_COMPONENTS]`)
 *
 * Components actually installed are the union of:
 *   - the templates' hard requirements (currently `sonner`)
 *   - better-auth's required primitives, when that feature is on
 *   - the user's selection from the wizard
 *
 * Best-effort: any failed step short-circuits and returns a populated
 * `skippedReason` so the outro can print fallback commands. The repo is
 * always left runnable.
 */
export const setupShadcn = (
  config: ProjectConfig
): Effect.Effect<ShadcnSetupReport, never, ProcessService> => {
  if (
    !config.install ||
    !config.features.includes("shadcn") ||
    config.shadcn === undefined
  ) {
    return Effect.succeed(SKIPPED_NOT_REQUESTED);
  }

  const cwd = shadcnCwdFor(config);
  const runner = runnerFor(config.packageManager);
  const wantsAll =
    config.shadcn.components.length === 1 &&
    config.shadcn.components[0] === SHADCN_ALL_COMPONENTS;

  return Effect.gen(function* () {
    const proc = yield* ProcessService;

    const initArgs = [
      ...runner.prefix,
      "init",
      "--preset",
      config.shadcn!.preset,
      "--base",
      "base",
      "--template",
      templateFor(config.framework),
      "--yes",
    ];
    if (config.layout === "monorepo") initArgs.push("--monorepo");

    const initialized = yield* proc
      .run(runner.bin, initArgs, { cwd, interactive: true })
      .pipe(
        Effect.as(true),
        Effect.catchTag("SpawnError", () => Effect.succeed(false))
      );

    if (!initialized) {
      return {
        ...SKIPPED_NOT_REQUESTED,
        skippedReason: "shadcn init did not complete.",
      };
    }

    if (wantsAll) {
      const addedAll = yield* proc
        .run(runner.bin, [...runner.prefix, "add", "--yes", "--all"], {
          cwd,
          interactive: true,
        })
        .pipe(
          Effect.as(true),
          Effect.catchTag("SpawnError", () => Effect.succeed(false))
        );

      return {
        initialized: true,
        componentsAdded: [],
        addedAll,
        ...(addedAll
          ? {}
          : { skippedReason: "shadcn add --all did not complete." }),
      };
    }

    const wantsBetterAuth = config.features.includes("better-auth");
    const baseRequired =
      config.layout === "monorepo"
        ? TEMPLATE_REQUIRED_MONOREPO
        : TEMPLATE_REQUIRED;
    const components = dedupe([
      ...baseRequired,
      ...(wantsBetterAuth ? BETTER_AUTH_REQUIRED : []),
      ...config.shadcn!.components,
    ]);

    if (components.length === 0) {
      return { initialized: true, componentsAdded: [], addedAll: false };
    }

    const added = yield* proc
      .run(runner.bin, [...runner.prefix, "add", "--yes", ...components], {
        cwd,
        interactive: true,
      })
      .pipe(
        Effect.as(true),
        Effect.catchTag("SpawnError", () => Effect.succeed(false))
      );

    return {
      initialized: true,
      componentsAdded: added ? components : [],
      addedAll: false,
      ...(added
        ? {}
        : {
            skippedReason: `shadcn add did not complete (${components.length} components requested).`,
          }),
    };
  });
};
