import { Effect, Context, Layer } from "effect";
import { join, resolve } from "node:path";
import nodePlop from "node-plop";
import {
  makeTurboShim,
  registerHandlebarsHelpers,
  type TemplateManifest,
} from "@turbocraft/core";
import { templatesRoot } from "@turbocraft/templates";
import { PlopError } from "../domain/errors.ts";

export type RunGeneratorInput = {
  readonly manifest: TemplateManifest;
  readonly generator: string;
  readonly targetDir: string;
  readonly answers: Readonly<Record<string, unknown>>;
};

export class PlopService extends Context.Tag("PlopService")<
  PlopService,
  {
    readonly run: (
      input: RunGeneratorInput
    ) => Effect.Effect<ReadonlyArray<string>, PlopError>;
  }
>() {}

const live = PlopService.of({
  run: ({ manifest, generator, targetDir, answers }) => {
    const generators = manifest.generators;
    if (generators === undefined) {
      return Effect.fail(
        new PlopError({
          variant: manifest.id,
          generator,
          cause: `Variant '${manifest.id}' has no generators directory.`,
        })
      );
    }
    const generatorsSource = resolve(templatesRoot(), generators.source);
    const configPath = join(generatorsSource, "config.ts");

    // node-plop walks process.cwd() for some action types, so we scope chdir
    // around the generator invocation with acquire/release semantics — even on
    // cancel or defect, cwd is restored.
    const scopedChdir = Effect.acquireRelease(
      Effect.sync(() => {
        const snapshot = process.cwd();
        process.chdir(targetDir);
        return snapshot;
      }),
      (snapshot) => Effect.sync(() => process.chdir(snapshot))
    );

    const runActions = Effect.tryPromise({
      try: async () => {
        const plop = await nodePlop(configPath, {
          destBasePath: targetDir,
          force: true,
        });
        registerHandlebarsHelpers(plop);
        const turbo = makeTurboShim(targetDir);
        const gen = plop.getGenerator(generator);
        const merged = { ...answers, turbo };
        const result = await gen.runActions(merged, {
          onComment: () => undefined,
        });
        if (result.failures.length > 0) {
          const first = result.failures[0];
          throw new Error(
            `Generator '${generator}' had ${result.failures.length} failure(s): ${first?.error ?? "unknown"}`
          );
        }
        return result.changes.map((c) => c.path);
      },
      catch: (cause) =>
        new PlopError({ variant: manifest.id, generator, cause }),
    });

    return Effect.scoped(
      Effect.gen(function* () {
        yield* scopedChdir;
        return yield* runActions;
      })
    );
  },
});

export const PlopLive = Layer.succeed(PlopService, live);
