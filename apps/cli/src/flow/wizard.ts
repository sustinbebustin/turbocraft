import { Effect } from "effect";
import { note } from "@clack/prompts";
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
import {
  promptText,
  promptSelect,
  promptConfirm,
  promptMultiselect,
} from "./prompts.ts";

export const DEFAULT_SHADCN_PRESET = "buFznsW";

export const extractPresetCode = (raw: string): string => {
  const trimmed = raw.trim();
  const match = trimmed.match(/--preset[=\s]+([A-Za-z0-9_-]+)/u);
  return match?.[1] ?? trimmed;
};

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

const findConflicts = (targetDir: string): ReadonlyArray<string> => {
  if (!existsSync(targetDir)) return [];
  try {
    return [...readdirSync(targetDir)].sort();
  } catch {
    return [];
  }
};

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

const runMainGroup = Effect.fn("runMainGroup")((
  input: WizardInput
): Effect.Effect<
  GroupAnswers,
  UserCancelled | TargetDirNotEmpty | WizardError
> =>
  Effect.gen(function* () {
    if (input.name !== undefined) {
      const targetDir = resolve(input.cwd, input.name);
      const conflicts = findConflicts(targetDir);
      if (conflicts.length > 0) {
        return yield* new TargetDirNotEmpty({ path: targetDir, conflicts });
      }
    }

    const name =
      input.name !== undefined
        ? input.name
        : yield* promptText("name", {
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
          });

    const framework =
      input.framework !== undefined
        ? input.framework
        : yield* promptSelect<FrameworkT>("framework", {
            message: "Framework",
            options: [
              { value: "nextjs", label: "Next.js" },
              { value: "tanstack", label: "TanStack Start" },
            ],
            initialValue: "nextjs",
          });

    const layout =
      input.layout !== undefined
        ? input.layout
        : yield* promptSelect<LayoutT>("layout", {
            message: "Layout",
            options: [
              { value: "monorepo", label: "Monorepo (apps/ + packages/)" },
              { value: "single", label: "Single app" },
            ],
            initialValue: "monorepo",
          });

    const featuresRaw =
      input.features !== undefined
        ? input.features
        : yield* promptMultiselect<FeatureT>("features", {
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
          });

    const packageManager =
      input.packageManager !== undefined
        ? input.packageManager
        : yield* promptSelect<PackageManagerT>("packageManager", {
            message: "Package manager",
            options: [
              { value: "pnpm", label: "pnpm (recommended)" },
              { value: "npm", label: "npm" },
              { value: "bun", label: "bun" },
            ],
            initialValue: "pnpm",
          });

    const install =
      input.install !== undefined
        ? input.install
        : yield* promptConfirm("install", {
            message: "Install dependencies?",
            initialValue: true,
          });

    const git =
      input.git !== undefined
        ? input.git
        : yield* promptConfirm("git", {
            message: "Initialise git?",
            initialValue: true,
          });

    return { name, framework, layout, featuresRaw, packageManager, install, git };
  }),
);

const promptShadcnPreset = Effect.fn("promptShadcnPreset")((
  fromFlag: string | undefined
): Effect.Effect<string, UserCancelled | WizardError> =>
  Effect.gen(function* () {
    if (fromFlag !== undefined) return extractPresetCode(fromFlag);

    const choice = yield* promptSelect<"default" | "custom">("shadcnPreset", {
      message: "shadcn preset",
      options: [
        {
          value: "default",
          label:
            "Default -- base style + lyra theme + phosphor icons (neutral)",
        },
        {
          value: "custom",
          label: "Custom -- paste a code from https://ui.shadcn.com/create",
        },
      ],
      initialValue: "default",
    });

    if (choice === "default") return DEFAULT_SHADCN_PRESET;

    const raw = yield* promptText("shadcnPreset", {
      message: "shadcn preset",
      placeholder: "paste from shadcn -- code, --preset code, or full command",
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Required.";
        const code = extractPresetCode(v);
        if (!/^[A-Za-z0-9_-]+$/u.test(code)) {
          return "Couldn't find a preset code. Paste the snippet shadcn shows, or just the code.";
        }
        return undefined;
      },
    });

    return extractPresetCode(raw);
  }),
);

const promptShadcnComponents = Effect.fn("promptShadcnComponents")((
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

    const choice = yield* promptSelect<"all" | "select" | "none">(
      "shadcnComponents",
      {
        message: "Components to install",
        options: [
          { value: "all", label: "All -- install every primitive" },
          { value: "select", label: "Select -- pick from the registry" },
          {
            value: "none",
            label: "None -- just init, I'll add components later",
          },
        ],
        initialValue: "select",
      }
    );

    if (choice === "all") return [SHADCN_ALL_COMPONENTS];
    if (choice === "none") return [];

    return yield* promptMultiselect<string>("shadcnComponents", {
      message: `Choose components (${names.length} available -- press 'a' to toggle all, space to toggle one, enter to confirm)`,
      options: names.map((n) => ({ value: n, label: n })),
      required: false,
    });
  }),
);

export const runWizard = Effect.fn("runWizard")((
  input: WizardInput
): Effect.Effect<
  ProjectConfig,
  UserCancelled | InvalidConfig | TargetDirNotEmpty | WizardError,
  ShadcnRegistry
> =>
  Effect.gen(function* () {
    const main = yield* runMainGroup(input);

    const shadcnImpliedByFlag =
      input.shadcnPreset !== undefined || input.shadcnComponents !== undefined;
    const featuresWithShadcn =
      shadcnImpliedByFlag && !main.featuresRaw.includes("shadcn")
        ? [...main.featuresRaw, "shadcn" as FeatureT]
        : main.featuresRaw;

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

    variantIdFor(parsed.data.framework, parsed.data.layout);
    return parsed.data;
  }),
);

export { Framework, Layout, Feature, PackageManager };
