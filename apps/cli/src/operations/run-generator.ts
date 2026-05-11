import { Effect } from "effect";
import type { TemplateManifest } from "@turbocraft/core";
import { PlopService } from "../services/Plop.ts";
import type { PlopError } from "../domain/errors.ts";

export type RunGeneratorInput = {
  readonly manifest: TemplateManifest;
  readonly targetDir: string;
  readonly answers: Readonly<Record<string, unknown>>;
};

export const runInitialGenerators = Effect.fn("runInitialGenerators")((
  input: RunGeneratorInput
): Effect.Effect<ReadonlyArray<string>, PlopError, PlopService> =>
  Effect.gen(function* () {
    const plop = yield* PlopService;
    const created: Array<string> = [];

    for (const gen of input.manifest.initialGenerators) {
      const merged = { ...gen.defaultAnswers, ...input.answers };
      const changes = yield* plop.run({
        manifest: input.manifest,
        generator: gen.name,
        targetDir: input.targetDir,
        answers: merged,
      });
      created.push(...changes);
    }
    return created;
  }),
);
