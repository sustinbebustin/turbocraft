import { z } from "zod";

export const Framework = z.enum(["nextjs", "tanstack"]);
export type Framework = z.infer<typeof Framework>;

export const Layout = z.enum(["monorepo", "single"]);
export type Layout = z.infer<typeof Layout>;

export const PackageManager = z.enum(["pnpm", "npm", "bun"]);
export type PackageManager = z.infer<typeof PackageManager>;

export const Feature = z.enum(["shadcn", "convex", "better-auth"]);
export type Feature = z.infer<typeof Feature>;

export const ProjectName = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u, {
    message: "Use kebab-case: lowercase letters, digits, hyphens.",
  });
export type ProjectName = z.infer<typeof ProjectName>;

export const SHADCN_ALL_COMPONENTS = "__all__" as const;

export const ShadcnConfig = z.object({
  // Either the named/code preset string passed to `shadcn init --preset`,
  // or "default" — resolved by the CLI to its baked-in default code.
  preset: z.string().min(1),
  // Empty array = init only. [SHADCN_ALL_COMPONENTS] = `add --all`.
  // Otherwise: explicit list of component names.
  components: z.array(z.string()).default([]),
});
export type ShadcnConfig = z.infer<typeof ShadcnConfig>;

export const ProjectConfig = z
  .object({
    name: ProjectName,
    targetDir: z.string().min(1),
    framework: Framework,
    layout: Layout,
    features: z.array(Feature).default([]),
    shadcn: ShadcnConfig.optional(),
    packageManager: PackageManager.default("pnpm"),
    install: z.boolean().default(true),
    git: z.boolean().default(true),
  })
  .refine(
    (cfg) =>
      !cfg.features.includes("better-auth") || cfg.features.includes("convex"),
    {
      message: "Better Auth requires Convex; enable both or neither.",
      path: ["features"],
    }
  )
  .refine(
    (cfg) =>
      !cfg.features.includes("better-auth") || cfg.features.includes("shadcn"),
    {
      message: "Better Auth requires shadcn; enable both or neither.",
      path: ["features"],
    }
  )
  .refine(
    (cfg) => !cfg.features.includes("shadcn") || cfg.shadcn !== undefined,
    {
      message: "shadcn feature requires a shadcn config block.",
      path: ["shadcn"],
    }
  );
export type ProjectConfig = z.infer<typeof ProjectConfig>;

export const VariantId = z.enum([
  "nextjs-monorepo",
  "nextjs-single",
  "tanstack-monorepo",
  "tanstack-single",
]);
export type VariantId = z.infer<typeof VariantId>;

export function variantIdFor(framework: Framework, layout: Layout): VariantId {
  if (framework === "nextjs") {
    return layout === "monorepo" ? "nextjs-monorepo" : "nextjs-single";
  }
  return layout === "monorepo" ? "tanstack-monorepo" : "tanstack-single";
}
