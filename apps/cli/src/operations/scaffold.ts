import { Effect } from "effect";
import { resolve } from "node:path";
import type { ProjectConfig } from "@turbocraft/core";
import { variantIdFor } from "@turbocraft/core";
import { FileSystemService } from "../services/FileSystem.ts";
import { PlopService } from "../services/Plop.ts";
import { PackageManagerService } from "../services/PackageManager.ts";
import { ProcessService } from "../services/Process.ts";
import { TemplatesService } from "../services/Templates.ts";
import { FsError, PlopError, SpawnError } from "../domain/errors.ts";
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

export const scaffold = (
  config: ProjectConfig
): Effect.Effect<
  ScaffoldReport,
  FsError | SpawnError | PlopError | ManifestError,
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
    if (!config.force) {
      const empty = yield* fs.isEmptyDir(targetDir);
      if (!empty) {
        return yield* new FsError({
          op: "ensureEmpty",
          path: targetDir,
          cause: `Target directory '${targetDir}' is not empty. Use --force to overwrite.`,
        });
      }
    }

    const initialAnswers = {
      // `projectName` is the user's chosen project name. `name` is the Plop
      // generator's "what should the new app be called" field (defaults to
      // "web") — keep them disjoint so they don't collide.
      projectName: config.name,
      withConvex: config.features.includes("convex"),
      withBetterAuth: config.features.includes("better-auth"),
    };

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

    let gitInitialised = false;
    if (config.git) {
      yield* initGit(targetDir);
      gitInitialised = true;
    }

    let installed = false;
    if (config.install) {
      yield* installDeps(targetDir, config.packageManager);
      installed = true;
    }

    return {
      variant: variantId,
      targetDir,
      created: [...seeded, ...generated],
      installed,
      gitInitialised,
    } satisfies ScaffoldReport;
  });
