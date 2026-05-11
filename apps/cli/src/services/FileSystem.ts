import { Effect, Context, Layer } from "effect";
import {
  cp as fsCp,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  rm as fsRm,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { FsError } from "../domain/errors.ts";

type CopyOptions = {
  readonly recursive?: boolean;
  readonly filter?: (src: string) => boolean;
};

export class FileSystemService extends Context.Tag("FileSystemService")<
  FileSystemService,
  {
    readonly exists: (path: string) => Effect.Effect<boolean>;
    readonly mkdirp: (path: string) => Effect.Effect<void, FsError>;
    readonly rm: (path: string) => Effect.Effect<void, FsError>;
    readonly copyDir: (
      from: string,
      to: string,
      options?: CopyOptions
    ) => Effect.Effect<void, FsError>;
    readonly isEmptyDir: (path: string) => Effect.Effect<boolean, FsError>;
    readonly listEntries: (
      path: string
    ) => Effect.Effect<ReadonlyArray<string>, FsError>;
  }
>() {}

const live = FileSystemService.of({
  exists: (path) =>
    Effect.sync(() => existsSync(path)).pipe(
      Effect.withSpan("FileSystem.exists")
    ),
  mkdirp: (path) =>
    Effect.tryPromise({
      try: () => fsMkdir(path, { recursive: true }).then(() => undefined),
      catch: (cause) => new FsError({ op: "mkdir", path, cause }),
    }).pipe(Effect.withSpan("FileSystem.mkdirp")),
  rm: (path) =>
    Effect.tryPromise({
      try: () => fsRm(path, { recursive: true, force: true }),
      catch: (cause) => new FsError({ op: "rm", path, cause }),
    }).pipe(Effect.withSpan("FileSystem.rm")),
  copyDir: (from, to, options) =>
    Effect.tryPromise({
      try: () =>
        fsCp(from, to, {
          recursive: options?.recursive ?? true,
          verbatimSymlinks: true,
          ...(options?.filter !== undefined ? { filter: options.filter } : {}),
        }),
      catch: (cause) =>
        new FsError({ op: "copyDir", path: `${from} -> ${to}`, cause }),
    }).pipe(Effect.withSpan("FileSystem.copyDir")),
  isEmptyDir: (path) =>
    Effect.tryPromise({
      try: async () => {
        if (!existsSync(path)) return true;
        const entries = await fsReaddir(path);
        return entries.length === 0;
      },
      catch: (cause) => new FsError({ op: "readdir", path, cause }),
    }).pipe(Effect.withSpan("FileSystem.isEmptyDir")),
  listEntries: (path) =>
    Effect.tryPromise({
      try: async () => {
        if (!existsSync(path)) return [] as ReadonlyArray<string>;
        const entries = await fsReaddir(path);
        return [...entries].sort();
      },
      catch: (cause) => new FsError({ op: "readdir", path, cause }),
    }).pipe(Effect.withSpan("FileSystem.listEntries")),
});

export const FileSystemLive = Layer.succeed(FileSystemService, live);
