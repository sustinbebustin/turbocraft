import { Effect } from "effect";
import {
  cancel,
  group,
  isCancel,
  note,
  text,
  select,
  multiselect,
  confirm,
} from "@clack/prompts";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  Feature,
  Framework,
  Layout,
  PackageManager,
  ProjectConfig,
  SHADCN_ALL_COMPONENTS,
  variantIdFor,
  type Feature as FeatureT,
  type Framework as FrameworkT,
  type Layout as LayoutT,
  type PackageManager as PackageManagerT,
  type ShadcnConfig,
} from "@turbocraft/core";
import {
  UserCancelled,
  InvalidConfig,
  TargetDirNotEmpty,
  WizardError,
} from "../domain/errors.ts";
import { allFeatureCompatibility } from "@turbocraft/templates";
import { ShadcnRegistry } from "../services/ShadcnRegistry.ts";

// Default preset code from https://ui.shadcn.com/create — base style + lyra
// theme + phosphor icons + neutral baseColor. Matches the components.json
// turbocraft used to ship before shadcn became opt-in.
export const DEFAULT_SHADCN_PRESET = "buFznsW";

/**
 * Accept whatever shadcn's "create" page hands the user — the copy button
 * yields a full command line like
 *   `pnpm dlx shadcn@latest init --preset a2r6bw --base base --template next`
 * — and reduce it to just the preset code. Falls through to the trimmed
 * input when no `--preset` token is found so a bare code still works.
 */
export const extractPresetCode = (raw: string): string => {
  const trimmed = raw.trim();
  const match = trimmed.match(/--preset[=\s]+([A-Za-z0-9_-]+)/u);
  return match?.[1] ?? trimmed;
};

// Used as a last-resort fallback when the shadcn registry index isn't
// reachable. Just enough primitives to keep the multiselect useful.
const FALLBACK_SHADCN_COMPONENTS: ReadonlyArray<string> = [
  "button",
  "card",
  "dialog",
  "dropdown-menu",
  "input",
  "label",
  "separator",
  "sheet",
  "sonner",
] as const;

export type WizardInput = {
  readonly name?: string;
  readonly framework?: FrameworkT;
  readonly layout?: LayoutT;
  readonly features?: ReadonlyArray<FeatureT>;
  readonly shadcnPreset?: string;
  readonly shadcnComponents?: ReadonlyArray<string>;
  readonly packageManager?: PackageManagerT;
  readonly install?: boolean;
  readonly git?: boolean;
  readonly cwd: string;
};

/**
 * Synchronous emptiness check used by both the interactive `text` validator
 * (which must be sync) and the early CLI-arg guard. Returns the sorted list
 * of conflicting entries, or `[]` if the directory is empty or missing.
 */
const findConflicts = (targetDir: string): ReadonlyArray<string> => {
  if (!existsSync(targetDir)) return [];
  try {
    return [...readdirSync(targetDir)].sort();
  } catch {
    return [];
  }
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

type GroupAnswers = {
  readonly name: string;
  readonly framework: FrameworkT;
  readonly layout: LayoutT;
  readonly featuresRaw: ReadonlyArray<FeatureT>;
  readonly packageManager: PackageManagerT;
  readonly install: boolean;
  readonly git: boolean;
};

const runMainGroup = (
  input: WizardInput
): Effect.Effect<
  GroupAnswers,
  UserCancelled | TargetDirNotEmpty | WizardError
> =>
  Effect.tryPromise({
    try: async () => {
      if (input.name !== undefined) {
        const targetDir = resolve(input.cwd, input.name);
        const conflicts = findConflicts(targetDir);
        if (conflicts.length > 0) {
          throw new TargetDirNotEmpty({ path: targetDir, conflicts });
        }
      }

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
                    const targetDir = resolve(input.cwd, v);
                    const conflicts = findConflicts(targetDir);
                    if (conflicts.length > 0) {
                      const preview = conflicts.slice(0, 3).join(", ");
                      const more =
                        conflicts.length > 3
                          ? ` (+${conflicts.length - 3} more)`
                          : "";
                      return `Directory '${v}' is not empty: ${preview}${more}. Pick a different name.`;
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
                    "Features (space to toggle; Better Auth implies Convex + shadcn)",
                  options: [
                    { value: "shadcn", label: "shadcn/ui components" },
                    { value: "convex", label: "Convex backend" },
                    {
                      value: "better-auth",
                      label: "Better Auth (requires Convex + shadcn)",
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

      return {
        name: guard(answers.name, "name"),
        framework: guard(answers.framework, "framework"),
        layout: guard(answers.layout, "layout"),
        featuresRaw: guard(answers.features, "features") ?? [],
        packageManager: guard(answers.packageManager, "packageManager"),
        install: guard(answers.install, "install"),
        git: guard(answers.git, "git"),
      };
    },
    catch: (cause) => {
      if (cause instanceof UserCancelled) return cause;
      if (cause instanceof TargetDirNotEmpty) return cause;
      return new WizardError({ cause });
    },
  });

const promptShadcnPreset = (
  fromFlag: string | undefined
): Effect.Effect<string, UserCancelled | WizardError> =>
  Effect.tryPromise({
    try: async () => {
      if (fromFlag !== undefined) return extractPresetCode(fromFlag);
      const choice = guard(
        await select<"default" | "custom">({
          message: "shadcn preset",
          options: [
            {
              value: "default",
              label:
                "Default — base style + lyra theme + phosphor icons (neutral)",
            },
            {
              value: "custom",
              label: "Custom — paste a code from https://ui.shadcn.com/create",
            },
          ],
          initialValue: "default",
        }),
        "shadcnPreset"
      );
      if (choice === "default") return DEFAULT_SHADCN_PRESET;
      const raw = guard(
        await text({
          message: "shadcn preset",
          placeholder:
            "paste from shadcn — code, --preset code, or full command",
          validate: (v) => {
            if (!v || v.trim().length === 0) return "Required.";
            const code = extractPresetCode(v);
            if (!/^[A-Za-z0-9_-]+$/u.test(code)) {
              return "Couldn't find a preset code. Paste the snippet shadcn shows, or just the code.";
            }
            return undefined;
          },
        }),
        "shadcnPreset"
      );
      return extractPresetCode(raw);
    },
    catch: (cause) => {
      if (cause instanceof UserCancelled) return cause;
      return new WizardError({ cause });
    },
  });

/**
 * Fetch the live registry list, then run the components prompt.
 * Falls back to a hardcoded baseline on network failure (with a `note(...)`
 * so the user knows the picker isn't exhaustive).
 */
const promptShadcnComponents = (
  fromFlag: ReadonlyArray<string> | undefined
): Effect.Effect<
  ReadonlyArray<string>,
  UserCancelled | WizardError,
  ShadcnRegistry
> =>
  Effect.gen(function* () {
    if (fromFlag !== undefined) return fromFlag;

    const registry = yield* ShadcnRegistry;
    const names = yield* registry.fetchComponentNames().pipe(
      Effect.catchTag("NetworkError", () =>
        Effect.sync(() => {
          note(
            "Couldn't reach the shadcn registry; showing a small built-in list.\nYou can re-run with --shadcn-components all to install everything later.",
            "shadcn"
          );
          return FALLBACK_SHADCN_COMPONENTS;
        })
      )
    );

    return yield* Effect.tryPromise({
      try: async () => {
        const choice = guard(
          await select<"all" | "select" | "none">({
            message: "Components to install",
            options: [
              { value: "all", label: "All — install every primitive" },
              {
                value: "select",
                label: "Select — pick from the registry",
              },
              {
                value: "none",
                label: "None — just init, I'll add components later",
              },
            ],
            initialValue: "select",
          }),
          "shadcnComponents"
        );
        if (choice === "all") return [SHADCN_ALL_COMPONENTS];
        if (choice === "none") return [];

        // `@clack/core` natively binds `a` to toggleAll() on multiselect —
        // first press selects all, second clears, and it never submits. We
        // advertise that in the message since clack doesn't render a hint.
        const selected = guard(
          await multiselect<string>({
            message: `Choose components (${names.length} available — press 'a' to toggle all, space to toggle one, enter to confirm)`,
            options: names.map((n) => ({ value: n, label: n })),
            required: false,
          }),
          "shadcnComponents"
        );
        return selected;
      },
      catch: (cause) => {
        if (cause instanceof UserCancelled) return cause;
        return new WizardError({ cause });
      },
    });
  });

export const runWizard = (
  input: WizardInput
): Effect.Effect<
  ProjectConfig,
  UserCancelled | InvalidConfig | TargetDirNotEmpty | WizardError,
  ShadcnRegistry
> =>
  Effect.gen(function* () {
    const main = yield* runMainGroup(input);

    // Passing `--shadcn-preset` or `--shadcn-components` is a strong signal
    // the user wants shadcn even if they didn't list it via `--features`.
    const shadcnImpliedByFlag =
      input.shadcnPreset !== undefined || input.shadcnComponents !== undefined;
    const featuresWithShadcn =
      shadcnImpliedByFlag && !main.featuresRaw.includes("shadcn")
        ? [...main.featuresRaw, "shadcn" as FeatureT]
        : main.featuresRaw;

    // Expand feature requires from each feature's compatibility declaration
    // so e.g. better-auth pulls in convex + shadcn automatically.
    const features = expandFeatureRequires(featuresWithShadcn);

    let shadcn: ShadcnConfig | undefined;
    if (features.includes("shadcn")) {
      const preset = yield* promptShadcnPreset(input.shadcnPreset);
      const components = yield* promptShadcnComponents(input.shadcnComponents);
      shadcn = { preset, components: [...components] };
    }

    const parsed = ProjectConfig.safeParse({
      name: main.name,
      targetDir: resolve(input.cwd, main.name),
      framework: main.framework,
      layout: main.layout,
      features,
      shadcn,
      packageManager: main.packageManager,
      install: main.install,
      git: main.git,
    });

    if (!parsed.success) {
      return yield* new InvalidConfig({
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`
        ),
      });
    }

    // Touch the variant id at validation time so we fail early with a clear
    // message if the chosen combo isn't yet shipped.
    variantIdFor(parsed.data.framework, parsed.data.layout);
    return parsed.data;
  });

export { Framework, Layout, Feature, PackageManager };
