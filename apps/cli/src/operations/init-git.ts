import { Effect } from "effect";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ProcessService } from "../services/Process.ts";
import type { SpawnError } from "../domain/errors.ts";

export const initGit = (
  targetDir: string
): Effect.Effect<void, SpawnError, ProcessService> =>
  Effect.gen(function* () {
    // Skip if the target already has a repo (e.g. scaffolded with --force into
    // an existing project tree).
    if (existsSync(join(targetDir, ".git"))) return;

    const proc = yield* ProcessService;
    yield* proc.run("git", ["init", "-b", "main"], { cwd: targetDir });
    yield* proc.run("git", ["add", "-A"], { cwd: targetDir });
    // Pass identity inline so the initial commit succeeds even when the user
    // has no global git config (fresh CI box, ephemeral container). If commit
    // still fails (e.g. global pre-commit hook, forced GPG signing without a
    // key), swallow — the repo is initialised and staged; the user can finish
    // the commit themselves.
    yield* proc
      .run(
        "git",
        [
          "-c",
          "user.name=turbocraft",
          "-c",
          "user.email=noreply@turbocraft.dev",
          "commit",
          "-m",
          "chore: initial commit from turbocraft",
        ],
        { cwd: targetDir }
      )
      .pipe(Effect.catchTag("SpawnError", () => Effect.void));
  });
