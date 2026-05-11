import { Effect, Layer } from "effect";
import type { TemplateManifest, VariantId } from "@turbocraft/core";
import { ManifestError } from "@turbocraft/core";
import { FileSystemService } from "../src/services/FileSystem.ts";
import { PackageManagerService } from "../src/services/PackageManager.ts";
import { PlopService } from "../src/services/Plop.ts";
import { ProcessService } from "../src/services/Process.ts";
import { ShadcnRegistry } from "../src/services/ShadcnRegistry.ts";
import { TemplatesService } from "../src/services/Templates.ts";

export type StubFs = {
  readonly exists?: (path: string) => boolean;
  readonly mkdirp?: (path: string) => void;
  readonly rm?: (path: string) => void;
  readonly listEntries?: (path: string) => ReadonlyArray<string>;
  readonly rmCalls?: Array<string>;
};

export const makeTestFileSystem = (stub: StubFs = {}) => {
  const rmCalls = stub.rmCalls ?? [];
  return Layer.succeed(FileSystemService, {
    exists: (path) => Effect.succeed(stub.exists?.(path) ?? false),
    mkdirp: () => Effect.void,
    rm: (path) =>
      Effect.sync(() => {
        rmCalls.push(path);
        stub.rm?.(path);
      }),
    copyDir: () => Effect.void,
    isEmptyDir: () => Effect.succeed(true),
    listEntries: (path) =>
      Effect.succeed(stub.listEntries?.(path) ?? []),
  });
};

export const makeTestProcess = () =>
  Layer.succeed(ProcessService, {
    run: () => Effect.succeed({ stdout: "", stderr: "" }),
  });

export const makeTestPlop = () =>
  Layer.succeed(PlopService, {
    run: () => Effect.succeed([]),
  });

export const makeTestPackageManager = () =>
  Layer.succeed(PackageManagerService, {
    install: () => Effect.void,
  });

export const makeTestShadcnRegistry = (
  components: ReadonlyArray<string> = []
) =>
  Layer.succeed(ShadcnRegistry, {
    fetchComponentNames: () => Effect.succeed(components),
  });

export const makeTestTemplates = (opts: {
  readonly registry?: Partial<Record<VariantId, TemplateManifest>>;
  readonly root?: string;
} = {}) =>
  Layer.succeed(TemplatesService, {
    registry: (opts.registry ?? {}) as Record<VariantId, TemplateManifest>,
    get: (id) => {
      const m = opts.registry?.[id];
      if (m === undefined) {
        return Effect.fail(
          new ManifestError({
            variant: id,
            message: `Test: no manifest for '${id}'`,
          })
        );
      }
      return Effect.succeed(m);
    },
    root: () => opts.root ?? "/tmp/test-templates",
  });

export const makeTestLive = (opts?: {
  readonly fs?: StubFs;
  readonly templates?: Parameters<typeof makeTestTemplates>[0];
  readonly shadcnComponents?: ReadonlyArray<string>;
}) =>
  makeTestPackageManager().pipe(
    Layer.provideMerge(makeTestProcess()),
    Layer.provideMerge(makeTestFileSystem(opts?.fs)),
    Layer.provideMerge(makeTestPlop()),
    Layer.provideMerge(makeTestShadcnRegistry(opts?.shadcnComponents)),
    Layer.provideMerge(makeTestTemplates(opts?.templates)),
  );
