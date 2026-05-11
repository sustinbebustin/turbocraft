import { z } from "zod";

export const Framework = z.enum(["nextjs", "tanstack"]);
export type Framework = z.infer<typeof Framework>;

export const Layout = z.enum(["monorepo", "single"]);
export type Layout = z.infer<typeof Layout>;

export const PackageManager = z.enum(["pnpm", "npm", "bun"]);
export type PackageManager = z.infer<typeof PackageManager>;

export const Feature = z.enum(["convex", "better-auth"]);
export type Feature = z.infer<typeof Feature>;

export const ProjectName = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u, {
    message: "Use kebab-case: lowercase letters, digits, hyphens.",
  });
export type ProjectName = z.infer<typeof ProjectName>;

export const ProjectConfig = z
  .object({
    name: ProjectName,
    targetDir: z.string().min(1),
    framework: Framework,
    layout: Layout,
    features: z.array(Feature).default([]),
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
