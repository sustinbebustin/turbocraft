import { Effect } from "effect";
import { resolve } from "node:path";
import type { ProjectConfig } from "@turbocraft/core";
import { variantIdFor } from "@turbocraft/core";
import { FileSystemService } from "../services/FileSystem.ts";
import { PlopService } from "../services/Plop.ts";
import { PackageManagerService } from "../services/PackageManager.ts";
import { ProcessService } from "../services/Process.ts";
import { TemplatesService } from "../services/Templates.ts";
import {
  FsError,
  MergeParseError,
  PathEscape,
  PlopError,
  SpawnError,
  TargetDirNotEmpty,
} from "../domain/errors.ts";
import { ManifestError } from "@turbocraft/core";
import { seedTarget } from "./seed.ts";
import { runInitialGenerators } from "./run-generator.ts";
import { initGit } from "./init-git.ts";
import { installDeps } from "./install-deps.ts";

export type ScaffoldReport = {
  readonly variant: string;
  readonly targetDir: string;
  readonly created: ReadonlyArray<string>;
  readonly installed: boolean;
  readonly gitInitialised: boolean;
};

/**
 * File-emission + install pipeline. Post-install Convex setup is owned by
 * the calling command (see `commands/create.ts`) because it inherits stdio
 * for the interactive browser-login flow, which conflicts with this
 * pipeline's spinner UI.
 */
export const scaffold = Effect.fn("scaffold")(
  (
    config: ProjectConfig
  ): Effect.Effect<
    ScaffoldReport,
    | FsError
    | PathEscape
    | MergeParseError
    | TargetDirNotEmpty
    | SpawnError
    | PlopError
    | ManifestError,
    | FileSystemService
    | PlopService
    | PackageManagerService
    | ProcessService
    | TemplatesService
  > =>
    Effect.gen(function* () {
      const templates = yield* TemplatesService;
      const fs = yield* FileSystemService;

      const variantId = variantIdFor(config.framework, config.layout);
      const manifest = yield* templates.get(variantId);

      const targetDir = resolve(config.targetDir);
      const existing = yield* fs.listEntries(targetDir);
      if (existing.length > 0) {
        return yield* new TargetDirNotEmpty({
          path: targetDir,
          conflicts: existing,
        });
      }

      const initialAnswers = {
        projectName: config.name,
        withShadcn: config.features.includes("shadcn"),
        withConvex: config.features.includes("convex"),
        withBetterAuth: config.features.includes("better-auth"),
      };

      const work = Effect.gen(function* () {
        const seeded = yield* seedTarget({
          manifest,
          targetDir,
          features: config.features,
          answers: initialAnswers,
        });

        const generated = yield* runInitialGenerators({
          manifest,
          targetDir,
          answers: initialAnswers,
        });

        if (config.git) yield* initGit(targetDir);
        if (config.install)
          yield* installDeps(targetDir, config.packageManager);

        return {
          variant: variantId,
          targetDir,
          created: [...seeded, ...generated],
          installed: config.install,
          gitInitialised: config.git,
        } satisfies ScaffoldReport;
      });

      return yield* work.pipe(
        Effect.onError(() => fs.rm(targetDir).pipe(Effect.ignore))
      );
    })
);
