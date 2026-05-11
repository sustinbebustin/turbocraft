import { Effect, Context, Layer } from "effect";
import type { PackageManager } from "@turbocraft/core";
import { ProcessService } from "./Process.ts";
import type { SpawnError } from "../domain/errors.ts";

export type InstallOptions = {
  readonly cwd: string;
  readonly packageManager: PackageManager;
};

export class PackageManagerService extends Context.Tag("PackageManagerService")<
  PackageManagerService,
  {
    readonly install: (
      options: InstallOptions
    ) => Effect.Effect<void, SpawnError>;
  }
>() {}

export const PackageManagerLive = Layer.effect(
  PackageManagerService,
  Effect.gen(function* () {
    const proc = yield* ProcessService;
    return {
      install: ({ cwd, packageManager }) =>
        // pnpm, npm and bun all use `install` — kept as a literal rather than
        // a per-PM branch since the args coincide.
        proc
          .run(packageManager, ["install"], { cwd })
          .pipe(Effect.asVoid, Effect.withSpan("PackageManager.install")),
    };
  })
);
