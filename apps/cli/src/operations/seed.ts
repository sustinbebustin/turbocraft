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
import { FsError } from "../domain/errors.ts";

export type SeedInput = {
  readonly manifest: TemplateManifest;
  readonly targetDir: string;
  /** Features enabled by the user; controls which feature-layers apply. */
  readonly features: ReadonlyArray<Feature>;
  /** Bag of values available to `*.hbs` files and merge templating. */
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

/**
 * Deep-merge JSON-compatible values. Arrays concatenate (with primitive
 * dedupe). Objects merge recursively. Primitives / mismatched types: later
 * wins. This is the semantics used for `*.merge.json` layer files.
 */
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
  /** Absolute path of the source entry. */
  readonly src: string;
  /** Path relative to the layer's `from` root. */
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
    // `readdir({recursive:true})` returns every descendant, so a `node_modules`
    // anywhere in the path (not just top-level) must be skipped.
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
  /** Accumulators for `*.merge.json` files, keyed by absolute destination path. */
  readonly mergeAcc: Map<string, unknown>;
  /** Track which paths the scaffolder wrote (for the report). */
  readonly emitted: Set<string>;
};

const assertContained = (parent: string, child: string, label: string) => {
  const p = resolve(parent);
  const c = resolve(child);
  if (c !== p && !c.startsWith(p + sep)) {
    throw new Error(
      `${label}: resolved path '${c}' escapes '${p}'. Refusing to continue.`
    );
  }
};

const applyEntry = async (
  layer: CopyEntry,
  entry: DirEntry,
  ctx: ApplyContext
): Promise<void> => {
  const destBase = resolve(ctx.targetDir, layer.to);
  assertContained(ctx.targetDir, destBase, "layer.to");
  let destRel = entry.rel;

  // Strip the `.hbs` suffix from the destination so the output reads as the
  // logical target (e.g., `package.json.hbs` -> `package.json`).
  const isHbs = destRel.endsWith(HBS_SUFFIX);
  if (isHbs) destRel = destRel.slice(0, -HBS_SUFFIX.length);

  const isMerge = destRel.endsWith(MERGE_SUFFIX);
  if (isMerge) {
    // `package.json.merge.json` -> accumulator key `package.json`.
    destRel = destRel.slice(0, -MERGE_SUFFIX.length);
  }

  const destAbs = resolve(destBase, destRel);
  assertContained(ctx.targetDir, destAbs, "destination");

  if (entry.kind === "directory") {
    await fsMkdir(destAbs, { recursive: true });
    return;
  }

  await fsMkdir(dirname(destAbs), { recursive: true });

  if (entry.kind === "symlink") {
    const target = await fsReadlink(entry.src);
    // Refuse symlinks that resolve outside the target tree (e.g. absolute
    // paths, or `..` traversals). Templates today ship relative-within-tree
    // links only; this is defense-in-depth against a hostile template.
    const resolvedTarget = resolve(dirname(destAbs), target);
    assertContained(ctx.targetDir, resolvedTarget, "symlink target");
    await fsSymlink(target, destAbs).catch(
      async (err: NodeJS.ErrnoException) => {
        if (err.code !== "EEXIST") throw err;
      }
    );
    ctx.emitted.add(destAbs);
    return;
  }

  if (isMerge) {
    const raw = await fsReadFile(entry.src, "utf8");
    const rendered = render(raw, ctx.answers);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rendered);
    } catch (cause) {
      throw new Error(
        `Failed to parse merge layer '${entry.src}' as JSON after rendering: ${String(cause)}`
      );
    }
    const previous = ctx.mergeAcc.get(destAbs);
    ctx.mergeAcc.set(
      destAbs,
      previous === undefined ? parsed : deepMerge(previous, parsed)
    );
    return;
  }

  if (isHbs) {
    const raw = await fsReadFile(entry.src, "utf8");
    await fsWriteFile(destAbs, render(raw, ctx.answers), "utf8");
    ctx.emitted.add(destAbs);
    return;
  }

  await fsCopyFile(entry.src, destAbs);
  ctx.emitted.add(destAbs);
};

const applyLayer = async (
  layer: CopyEntry,
  ctx: ApplyContext
): Promise<void> => {
  const absFrom = resolve(ctx.templatesRoot, layer.from);
  assertContained(ctx.templatesRoot, absFrom, "layer.from");
  const entries = await walkLayer(absFrom);
  // Ensure directories come before their children so mkdir order is correct.
  const sorted = [...entries].sort((a, b) => a.rel.localeCompare(b.rel));
  for (const entry of sorted) {
    await applyEntry(layer, entry, ctx);
  }
};

const flushMerges = async (ctx: ApplyContext): Promise<void> => {
  for (const [destAbs, value] of ctx.mergeAcc) {
    // If a non-merge layer already wrote this file, merge into its contents.
    let base: unknown = value;
    if (ctx.emitted.has(destAbs) && existsSync(destAbs)) {
      try {
        const raw = await fsReadFile(destAbs, "utf8");
        base = deepMerge(JSON.parse(raw), value);
      } catch {
        // existing file isn't JSON-parseable; fall back to merge value only.
      }
    }
    await fsMkdir(dirname(destAbs), { recursive: true });
    await fsWriteFile(destAbs, `${JSON.stringify(base, null, 2)}\n`, "utf8");
    ctx.emitted.add(destAbs);
  }
};

export const seedTarget = (
  input: SeedInput
): Effect.Effect<
  ReadonlyArray<string>,
  FsError,
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

    const run = Effect.tryPromise({
      try: async () => {
        for (const layer of orderedLayers) {
          await applyLayer(layer, ctx);
        }
        await flushMerges(ctx);
      },
      catch: (cause) =>
        new FsError({ op: "applyLayers", path: input.targetDir, cause }),
    });

    yield* run;

    // Copy variant's generator directory to <target>/turbo/generators so
    // `turbo gen run` keeps working inside the generated repo. Single-app
    // variants opt out by omitting `manifest.generators`.
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
  });
