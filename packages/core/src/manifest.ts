import type { Feature, VariantId } from "./schema.ts";

/**
 * A single source -> destination overlay step. `from` is a path *relative to
 * the templates root* (resolved at scaffold time by the runtime). `to` is a
 * path inside the generated project, with "." meaning the project root.
 */
export type CopyEntry = {
  readonly from: string;
  readonly to: string;
};

export type GeneratorRef = {
  /** Generator name as registered by Plop (e.g. "app", "page"). */
  readonly name: string;
  /** Default answers fed in non-interactively for the initial scaffold. */
  readonly defaultAnswers: Readonly<Record<string, unknown>>;
};

/**
 * Per-feature overlay layers, applied only when the feature is enabled.
 * Keyed by the feature id from {@link Feature}.
 */
export type FeatureLayers = Readonly<
  Partial<Record<Feature, ReadonlyArray<CopyEntry>>>
>;

export type TemplateManifest = {
  readonly id: VariantId;
  /**
   * Ordered overlay layers applied unconditionally. Later layers overwrite
   * earlier ones at the same destination path (with special handling for
   * `*.hbs` and `*.merge.json` files — see the scaffolder docs).
   */
  readonly layers: ReadonlyArray<CopyEntry>;
  /**
   * Ordered overlay layers applied only when the named feature is enabled.
   * Applied after `layers`, in the order features are declared here.
   */
  readonly featureLayers?: FeatureLayers;
  /**
   * Plop generators directory copied verbatim to
   * `<output>/turbo/generators/` so `turbo gen run` continues to work
   * inside the generated repo. Omit for single-app variants.
   */
  readonly generators?: {
    readonly source: string;
    readonly destination: string;
  };
  /**
   * Generators invoked at scaffold time, in order. Empty for variants where
   * the layer composition produces the whole project.
   */
  readonly initialGenerators: ReadonlyArray<GeneratorRef>;
  /**
   * Feature flags this variant honors. The CLI hides flags absent here.
   */
  readonly supportedFeatures: ReadonlyArray<Feature>;
};

export type ManifestRegistry = Readonly<
  Partial<Record<VariantId, TemplateManifest>>
>;

/**
 * Declarative compatibility metadata for a feature. Loaded by the wizard to
 * enforce inter-feature dependencies without hard-coding rules in the CLI.
 */
export type FeatureCompatibility = {
  /**
   * Other features that must also be enabled when this one is enabled.
   * Example: better-auth requires convex.
   */
  readonly requires: ReadonlyArray<Feature>;
};
