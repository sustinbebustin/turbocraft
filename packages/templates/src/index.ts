import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";
import type {
  Feature,
  FeatureCompatibility,
  ManifestRegistry,
  TemplateManifest,
} from "@turbocraft/core";
import { manifest as nextjsMonorepoManifest } from "./variants/nextjs-monorepo.ts";
import { manifest as nextjsSingleManifest } from "./variants/nextjs-single.ts";
import { manifest as tanstackMonorepoManifest } from "./variants/tanstack-monorepo.ts";
import { manifest as tanstackSingleManifest } from "./variants/tanstack-single.ts";
import { compatibility as convexCompatibility } from "./features/convex/compatibility.ts";
import { compatibility as betterAuthCompatibility } from "./features/better-auth/compatibility.ts";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Root directory containing the template assets. When the templates package
 * is bundled into `dist/`, set `TURBOCRAFT_TEMPLATES_ROOT` (or override via
 * {@link setTemplatesRoot}) to point at the runtime copy of `src/`.
 */
let templatesRootOverride: string | null = null;

export function setTemplatesRoot(path: string): void {
  templatesRootOverride = resolve(path);
}

export function templatesRoot(): string {
  if (templatesRootOverride !== null) return templatesRootOverride;
  const envRoot = process.env.TURBOCRAFT_TEMPLATES_ROOT;
  if (envRoot !== undefined && envRoot.length > 0) return resolve(envRoot);
  // In source mode (tsx / vitest), `import.meta.url` points at <pkg>/src/index.ts
  // so `here` already *is* the templates root. In built mode it's <pkg>/dist/,
  // and the runtime copy lives next door at <pkg>/src/ (or is overridden via
  // env / setTemplatesRoot for the published CLI bundle).
  if (basename(here) === "src") return here;
  return resolve(here, "..", "src");
}

/** Resolve a templates-root-relative path to an absolute path. */
export function resolveTemplatePath(relative: string): string {
  return resolve(templatesRoot(), relative);
}

export const manifest: ManifestRegistry = {
  "nextjs-monorepo": nextjsMonorepoManifest,
  "tanstack-monorepo": tanstackMonorepoManifest,
  "nextjs-single": nextjsSingleManifest,
  "tanstack-single": tanstackSingleManifest,
};

/**
 * Inter-feature dependency declarations, sourced from each feature's
 * `compatibility.ts`. Adding a new feature: drop a new `features/<id>/` dir
 * and add a line here; the wizard auto-respects the constraint.
 */
const compatibility: Readonly<Record<Feature, FeatureCompatibility>> = {
  convex: convexCompatibility,
  "better-auth": betterAuthCompatibility,
};

export function loadCompatibility(feature: Feature): FeatureCompatibility {
  return compatibility[feature];
}

export function allFeatureCompatibility(): Readonly<
  Record<Feature, FeatureCompatibility>
> {
  return compatibility;
}

export type { TemplateManifest, ManifestRegistry };
