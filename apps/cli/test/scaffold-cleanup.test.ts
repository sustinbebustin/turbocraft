import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import type { ProjectConfig, TemplateManifest } from "@turbocraft/core";
import { scaffold } from "../src/operations/scaffold.ts";
import { FileSystemService } from "../src/services/FileSystem.ts";
import { FsError } from "../src/domain/errors.ts";
import {
  makeTestLive,
  makeTestFileSystem,
  makeTestTemplates,
} from "./layers.ts";

const fakeManifest: TemplateManifest = {
  id: "nextjs-monorepo",
  layers: [],
  generators: { source: "gen", destination: "turbo/generators" },
};

const baseConfig: ProjectConfig = {
  name: "my-app",
  targetDir: "/tmp/scaffold-cleanup-test",
  framework: "nextjs",
  layout: "monorepo",
  features: [],
  packageManager: "pnpm",
  install: false,
  git: false,
};

describe("scaffold cleanup on failure", () => {
  it.effect("calls fs.rm on the target dir when seedTarget fails", () => {
    const rmCalls: Array<string> = [];
    const failingFs = Layer.succeed(FileSystemService, {
      exists: () => Effect.succeed(false),
      mkdirp: () => Effect.void,
      rm: (path) =>
        Effect.sync(() => {
          rmCalls.push(path);
        }),
      copyDir: (_from, _to) =>
        Effect.fail(
          new FsError({ op: "copyDir", path: _from, cause: "test failure" })
        ),
      isEmptyDir: () => Effect.succeed(true),
      listEntries: () => Effect.succeed([]),
    });

    const testLayer = failingFs.pipe(
      Layer.provideMerge(
        makeTestLive({
          templates: {
            registry: { "nextjs-monorepo": fakeManifest },
            root: "/tmp/test-templates",
          },
        })
      )
    );

    return Effect.gen(function* () {
      const exit = yield* scaffold(baseConfig).pipe(
        Effect.provide(testLayer),
        Effect.exit
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
        if (failure._tag === "Some") {
          expect(failure.value._tag).toBe("FsError");
        }
      }
      expect(rmCalls).toContain("/tmp/scaffold-cleanup-test");
    });
  });

  it.effect(
    "does not call fs.rm when target dir is not empty (TargetDirNotEmpty)",
    () => {
      const rmCalls: Array<string> = [];
      const nonEmptyFs = Layer.succeed(FileSystemService, {
        exists: () => Effect.succeed(true),
        mkdirp: () => Effect.void,
        rm: (path) =>
          Effect.sync(() => {
            rmCalls.push(path);
          }),
        copyDir: () => Effect.void,
        isEmptyDir: () => Effect.succeed(false),
        listEntries: () => Effect.succeed(["existing-file.txt"]),
      });

      const testLayer = nonEmptyFs.pipe(
        Layer.provideMerge(
          makeTestLive({
            templates: {
              registry: { "nextjs-monorepo": fakeManifest },
              root: "/tmp/test-templates",
            },
          })
        )
      );

      return Effect.gen(function* () {
        const exit = yield* scaffold(baseConfig).pipe(
          Effect.provide(testLayer),
          Effect.exit
        );
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const failure = Cause.failureOption(exit.cause);
          expect(failure._tag).toBe("Some");
          if (failure._tag === "Some") {
            expect(failure.value._tag).toBe("TargetDirNotEmpty");
          }
        }
        expect(rmCalls).toHaveLength(0);
      });
    }
  );
});
