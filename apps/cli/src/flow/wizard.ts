import { Effect } from "effect";
import {
  cancel,
  group,
  isCancel,
  text,
  select,
  multiselect,
  confirm,
} from "@clack/prompts";
import { resolve } from "node:path";
import {
  Feature,
  Framework,
  Layout,
  PackageManager,
  ProjectConfig,
  variantIdFor,
  type Feature as FeatureT,
  type Framework as FrameworkT,
  type Layout as LayoutT,
  type PackageManager as PackageManagerT,
} from "@turbocraft/core";
import { UserCancelled, InvalidConfig, WizardError } from "../domain/errors.ts";
import { allFeatureCompatibility } from "@turbocraft/templates";

export type WizardInput = {
  readonly name?: string;
  readonly framework?: FrameworkT;
  readonly layout?: LayoutT;
  readonly features?: ReadonlyArray<FeatureT>;
  readonly packageManager?: PackageManagerT;
  readonly install?: boolean;
  readonly git?: boolean;
  readonly force?: boolean;
  readonly cwd: string;
};

const guard = <T>(value: T | symbol, stage: string): T => {
  if (isCancel(value)) {
    cancel("Cancelled.");
    throw new UserCancelled({ stage });
  }
  return value as T;
};

/**
 * Expand a user-selected feature set with any features they declaratively
 * require (per `features/<id>/compatibility.ts`). Closes over `allFeatureCompatibility()`
 * so adding a new feature with `requires: [...]` propagates here automatically.
 */
const expandFeatureRequires = (
  initial: ReadonlyArray<FeatureT>
): ReadonlyArray<FeatureT> => {
  const compat = allFeatureCompatibility();
  const out = new Set<FeatureT>(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of [...out]) {
      const entry = compat[f];
      if (entry === undefined) continue;
      for (const required of entry.requires) {
        if (!out.has(required)) {
          out.add(required);
          changed = true;
        }
      }
    }
  }
  return [...out];
};

export const runWizard = (
  input: WizardInput
): Effect.Effect<ProjectConfig, UserCancelled | InvalidConfig | WizardError> =>
  Effect.tryPromise({
    try: async () => {
      const answers = await group(
        {
          name: () =>
            input.name !== undefined
              ? Promise.resolve(input.name)
              : text({
                  message: "Project name",
                  placeholder: "my-app",
                  validate: (v) => {
                    if (!v) return "Required.";
                    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u.test(v)) {
                      return "Use kebab-case: lowercase letters, digits, hyphens.";
                    }
                    return undefined;
                  },
                }),
          framework: () =>
            input.framework !== undefined
              ? Promise.resolve(input.framework)
              : select<FrameworkT>({
                  message: "Framework",
                  options: [
                    { value: "nextjs", label: "Next.js" },
                    { value: "tanstack", label: "TanStack Start" },
                  ],
                  initialValue: "nextjs",
                }),
          layout: () =>
            input.layout !== undefined
              ? Promise.resolve(input.layout)
              : select<LayoutT>({
                  message: "Layout",
                  options: [
                    {
                      value: "monorepo",
                      label: "Monorepo (apps/ + packages/)",
                    },
                    { value: "single", label: "Single app" },
                  ],
                  initialValue: "monorepo",
                }),
          features: () =>
            input.features !== undefined
              ? Promise.resolve([...input.features])
              : multiselect<FeatureT>({
                  message:
                    "Features (space to toggle; Better Auth implies Convex)",
                  options: [
                    { value: "convex", label: "Convex backend" },
                    {
                      value: "better-auth",
                      label: "Better Auth (requires Convex)",
                    },
                  ],
                  required: false,
                }),
          packageManager: () =>
            input.packageManager !== undefined
              ? Promise.resolve(input.packageManager)
              : select<PackageManagerT>({
                  message: "Package manager",
                  options: [
                    { value: "pnpm", label: "pnpm (recommended)" },
                    { value: "npm", label: "npm" },
                    { value: "bun", label: "bun" },
                  ],
                  initialValue: "pnpm",
                }),
          install: () =>
            input.install !== undefined
              ? Promise.resolve(input.install)
              : confirm({
                  message: "Install dependencies?",
                  initialValue: true,
                }),
          git: () =>
            input.git !== undefined
              ? Promise.resolve(input.git)
              : confirm({ message: "Initialise git?", initialValue: true }),
        },
        {
          onCancel: () => {
            cancel("Cancelled.");
            throw new UserCancelled({ stage: "wizard" });
          },
        }
      );

      const name = guard(answers.name, "name");
      const framework = guard(answers.framework, "framework");
      const layout = guard(answers.layout, "layout");
      const featuresRaw = guard(answers.features, "features") ?? [];
      const packageManager = guard(answers.packageManager, "packageManager");
      const install = guard(answers.install, "install");
      const git = guard(answers.git, "git");

      // Expand feature requires from each feature's compatibility declaration
      // so e.g. better-auth pulls in convex automatically.
      const features = expandFeatureRequires(featuresRaw);

      const parsed = ProjectConfig.safeParse({
        name,
        targetDir: resolve(input.cwd, name),
        framework,
        layout,
        features,
        packageManager,
        install,
        git,
        force: input.force ?? false,
      });

      if (!parsed.success) {
        throw new InvalidConfig({
          issues: parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`
          ),
        });
      }

      // Touch the variant id at validation time so we fail early with a clear
      // message if the chosen combo isn't yet shipped.
      variantIdFor(parsed.data.framework, parsed.data.layout);
      return parsed.data;
    },
    catch: (cause) => {
      if (cause instanceof UserCancelled) return cause;
      if (cause instanceof InvalidConfig) return cause;
      return new WizardError({ cause });
    },
  });

export { Framework, Layout, Feature, PackageManager };
