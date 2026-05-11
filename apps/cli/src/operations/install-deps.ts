import { Effect } from "effect";
import type { PackageManager } from "@turbocraft/core";
import { PackageManagerService } from "../services/PackageManager.ts";
import type { SpawnError } from "../domain/errors.ts";

export const installDeps = (
  targetDir: string,
  packageManager: PackageManager
): Effect.Effect<void, SpawnError, PackageManagerService> =>
  Effect.gen(function* () {
    const pm = yield* PackageManagerService;
    yield* pm.install({ cwd: targetDir, packageManager });
  });
