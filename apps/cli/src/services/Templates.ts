import { Effect, Context, Layer } from "effect";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  manifest,
  setTemplatesRoot,
  templatesRoot,
  type ManifestRegistry,
  type TemplateManifest,
} from "@turbocraft/templates";
import type { VariantId } from "@turbocraft/core";
import { ManifestError } from "@turbocraft/core";

export class TemplatesService extends Context.Tag("TemplatesService")<
  TemplatesService,
  {
    readonly registry: ManifestRegistry;
    readonly get: (
      id: VariantId
    ) => Effect.Effect<TemplateManifest, ManifestError>;
    readonly root: () => string;
  }
>() {}

const resolveBundledTemplates = (): string | null => {
  // When invoked as `apps/cli/dist/bin.js`, the publish-time layout places
  // templates at `apps/cli/templates/`.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, "..", "templates");
  return existsSync(candidate) ? candidate : null;
};

const bundled = resolveBundledTemplates();
if (bundled !== null) {
  setTemplatesRoot(bundled);
}

const live = TemplatesService.of({
  registry: manifest,
  get: (id) => {
    const value = manifest[id];
    if (value === undefined) {
      return Effect.fail(
        new ManifestError({
          variant: id,
          message: `No manifest registered for variant '${id}'. Available: ${Object.keys(manifest).join(", ")}`,
        })
      ).pipe(Effect.withSpan("Templates.get"));
    }
    return Effect.succeed(value).pipe(Effect.withSpan("Templates.get"));
  },
  root: () => templatesRoot(),
});

export const TemplatesLive = Layer.succeed(TemplatesService, live);
