import { resolve } from "node:path";

/**
 * Recreates the `turbo` answer object that `turbo gen` injects into Plop
 * generators when invoked inside a Turborepo. Generator templates can use
 * `{{ turbo.paths.root }}` identically whether driven by `turbocraft create`
 * or `turbo gen run`.
 */
export type TurboShim = {
  paths: {
    root: string;
    workspace: string | undefined;
  };
};

export function makeTurboShim(rootDir: string, workspace?: string): TurboShim {
  return {
    paths: {
      root: resolve(rootDir),
      workspace:
        workspace === undefined ? undefined : resolve(rootDir, workspace),
    },
  };
}
