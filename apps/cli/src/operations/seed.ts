import { Effect } from "effect";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  copyFile as fsCopyFile,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  readFile as fsReadFile,
  readlink as fsReadlink,
  symlink as fsSymlink,
  writeFile as fsWriteFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import Handlebars from "handlebars";
import type { CopyEntry, Feature, TemplateManifest } from "@turbocraft/core";
import { handlebarsHelpers } from "@turbocraft/core";
import { TemplatesService } from "../services/Templates.ts";
import { FileSystemService } from "../services/FileSystem.ts";
import { FsError, PathEscape, MergeParseError } from "../domain/errors.ts";

export type SeedInput = {
  readonly manifest: TemplateManifest;
  readonly targetDir: string;
  readonly features: ReadonlyArray<Feature>;
  readonly answers: Readonly<Record<string, unknown>>;
};

const hbs = Handlebars.create();
for (const [name, fn] of Object.entries(handlebarsHelpers)) {
  hbs.registerHelper(name, fn);
}

const HBS_SUFFIX = ".hbs";
const MERGE_SUFFIX = ".merge.json";
const SKIP_FILE_NAMES = new Set([".tsbuildinfo"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const deepMerge = (a: unknown, b: unknown): unknown => {
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: Array<unknown> = [...a];
    for (const item of b) {
      const isPrim =
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean";
      if (isPrim) {
        if (!out.includes(item)) out.push(item);
      } else {
        out.push(item);
      }
    }
    return out;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = k in out ? deepMerge(out[k], v) : v;
    }
    return out;
  }
  return b;
};

const render = (
  source: string,
  answers: Readonly<Record<string, unknown>>
): string => hbs.compile(source, { noEscape: true })(answers);

type DirEntry = {
  readonly src: string;
  readonly rel: string;
  readonly kind: "file" | "directory" | "symlink";
};

const walkLayer = async (root: string): Promise<ReadonlyArray<DirEntry>> => {
  if (!existsSync(root)) return [];
  const entries = await fsReaddir(root, {
    recursive: true,
    withFileTypes: true,
  });
  const result: Array<DirEntry> = [];
  for (const entry of entries) {
    if (SKIP_FILE_NAMES.has(entry.name)) continue;
    const src = join(entry.parentPath, entry.name);
    const rel = relative(root, src);
    if (rel === "" || rel.startsWith("..")) continue;
    if (rel.split(/[\\/]/u).includes("node_modules")) continue;
    if (entry.isSymbolicLink()) {
      result.push({ src, rel, kind: "symlink" });
    } else if (entry.isDirectory()) {
      result.push({ src, rel, kind: "directory" });
    } else if (entry.isFile()) {
      result.push({ src, rel, kind: "file" });
    }
  }
  return result;
};

type ApplyContext = {
  readonly templatesRoot: string;
  readonly targetDir: string;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly mergeAcc: Map<string, unknown>;
  readonly emitted: Set<string>;
};

const assertContained = (
  parent: string,
  child: string,
  label: string
): Effect.Effect<void, PathEscape> => {
  const p = resolve(parent);
  const c = resolve(child);
  if (c !== p && !c.startsWith(p + sep)) {
    return Effect.fail(new PathEscape({ label, parent: p, child: c }));
  }
  return Effect.void;
};

const applyEntryEffect = (
  layer: CopyEntry,
  entry: DirEntry,
  ctx: ApplyContext
): Effect.Effect<void, FsError | PathEscape | MergeParseError> =>
  Effect.gen(function* () {
    const destBase = resolve(ctx.targetDir, layer.to);
    yield* assertContained(ctx.targetDir, destBase, "layer.to");
    let destRel = entry.rel;

    const isHbs = destRel.endsWith(HBS_SUFFIX);
    if (isHbs) destRel = destRel.slice(0, -HBS_SUFFIX.length);

    const isMerge = destRel.endsWith(MERGE_SUFFIX);
    if (isMerge) {
      destRel = destRel.slice(0, -MERGE_SUFFIX.length);
    }

    const destAbs = resolve(destBase, destRel);
    yield* assertContained(ctx.targetDir, destAbs, "destination");

    if (entry.kind === "directory") {
      yield* Effect.tryPromise({
        try: () => fsMkdir(destAbs, { recursive: true }),
        catch: (cause) => new FsError({ op: "mkdir", path: destAbs, cause }),
      });
      return;
    }

    yield* Effect.tryPromise({
      try: () => fsMkdir(dirname(destAbs), { recursive: true }),
      catch: (cause) =>
        new FsError({ op: "mkdir", path: dirname(destAbs), cause }),
    });

    if (entry.kind === "symlink") {
      const target = yield* Effect.tryPromise({
        try: () => fsReadlink(entry.src),
        catch: (cause) =>
          new FsError({ op: "readlink", path: entry.src, cause }),
      });
      const resolvedTarget = resolve(dirname(destAbs), target);
      yield* assertContained(ctx.targetDir, resolvedTarget, "symlink target");
      yield* Effect.tryPromise({
        try: () =>
          fsSymlink(target, destAbs).catch(
            (err: NodeJS.ErrnoException) => {
              if (err.code !== "EEXIST") throw err;
            }
          ),
        catch: (cause) =>
          new FsError({ op: "symlink", path: destAbs, cause }),
      });
      ctx.emitted.add(destAbs);
      return;
    }

    if (isMerge) {
      const raw = yield* Effect.tryPromise({
        try: () => fsReadFile(entry.src, "utf8"),
        catch: (cause) =>
          new FsError({ op: "readFile", path: entry.src, cause }),
      });
      const rendered = render(raw, ctx.answers);
      const parsed = yield* Effect.try({
        try: () => JSON.parse(rendered) as unknown,
        catch: (cause) => new MergeParseError({ src: entry.src, cause }),
      });
      const previous = ctx.mergeAcc.get(destAbs);
      ctx.mergeAcc.set(
        destAbs,
        previous === undefined ? parsed : deepMerge(previous, parsed)
      );
      return;
    }

    if (isHbs) {
      const raw = yield* Effect.tryPromise({
        try: () => fsReadFile(entry.src, "utf8"),
        catch: (cause) =>
          new FsError({ op: "readFile", path: entry.src, cause }),
      });
      yield* Effect.tryPromise({
        try: () => fsWriteFile(destAbs, render(raw, ctx.answers), "utf8"),
        catch: (cause) =>
          new FsError({ op: "writeFile", path: destAbs, cause }),
      });
      ctx.emitted.add(destAbs);
      return;
    }

    yield* Effect.tryPromise({
      try: () => fsCopyFile(entry.src, destAbs),
      catch: (cause) =>
        new FsError({ op: "copyFile", path: `${entry.src} -> ${destAbs}`, cause }),
    });
    ctx.emitted.add(destAbs);
  });

const applyLayerEffect = (
  layer: CopyEntry,
  ctx: ApplyContext
): Effect.Effect<void, FsError | PathEscape | MergeParseError> =>
  Effect.gen(function* () {
    const absFrom = resolve(ctx.templatesRoot, layer.from);
    yield* assertContained(ctx.templatesRoot, absFrom, "layer.from");
    const entries = yield* Effect.tryPromise({
      try: () => walkLayer(absFrom),
      catch: (cause) =>
        new FsError({ op: "walkLayer", path: absFrom, cause }),
    });
    const sorted = [...entries].sort((a, b) => a.rel.localeCompare(b.rel));
    yield* Effect.forEach(sorted, (entry) => applyEntryEffect(layer, entry, ctx), {
      discard: true,
    });
  });

const flushMergesEffect = (
  ctx: ApplyContext
): Effect.Effect<void, FsError> =>
  Effect.forEach(
    [...ctx.mergeAcc],
    ([destAbs, value]) =>
      Effect.gen(function* () {
        let base: unknown = value;
        if (ctx.emitted.has(destAbs) && existsSync(destAbs)) {
          const existing = yield* Effect.tryPromise({
            try: () => fsReadFile(destAbs, "utf8"),
            catch: (cause) =>
              new FsError({ op: "readFile", path: destAbs, cause }),
          }).pipe(
            Effect.map((raw) => {
              try {
                return JSON.parse(raw) as unknown;
              } catch {
                return undefined;
              }
            })
          );
          if (existing !== undefined) {
            base = deepMerge(existing, value);
          }
        }
        yield* Effect.tryPromise({
          try: async () => {
            await fsMkdir(dirname(destAbs), { recursive: true });
            await fsWriteFile(
              destAbs,
              `${JSON.stringify(base, null, 2)}\n`,
              "utf8"
            );
          },
          catch: (cause) =>
            new FsError({ op: "writeFile", path: destAbs, cause }),
        });
        ctx.emitted.add(destAbs);
      }),
    { discard: true }
  );

export const seedTarget = Effect.fn("seedTarget")((
  input: SeedInput
): Effect.Effect<
  ReadonlyArray<string>,
  FsError | PathEscape | MergeParseError,
  FileSystemService | TemplatesService
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService;
    const templates = yield* TemplatesService;
    yield* fs.mkdirp(input.targetDir);

    const orderedLayers: Array<CopyEntry> = [...input.manifest.layers];
    if (input.manifest.featureLayers !== undefined) {
      for (const feature of input.features) {
        const featureLayers = input.manifest.featureLayers[feature];
        if (featureLayers !== undefined) {
          orderedLayers.push(...featureLayers);
        }
      }
    }

    const ctx: ApplyContext = {
      templatesRoot: templates.root(),
      targetDir: resolve(input.targetDir),
      answers: input.answers,
      mergeAcc: new Map(),
      emitted: new Set(),
    };

    yield* Effect.forEach(
      orderedLayers,
      (layer) => applyLayerEffect(layer, ctx),
      { discard: true }
    );
    yield* flushMergesEffect(ctx);

    if (input.manifest.generators !== undefined) {
      const generators = input.manifest.generators;
      const generatorsSource = resolve(templates.root(), generators.source);
      const generatorsTarget = resolve(input.targetDir, generators.destination);
      yield* fs.mkdirp(generatorsTarget);
      yield* fs.copyDir(generatorsSource, generatorsTarget, {
        recursive: true,
      });
      ctx.emitted.add(generatorsTarget);
    }

    return [...ctx.emitted];
  }),
);
