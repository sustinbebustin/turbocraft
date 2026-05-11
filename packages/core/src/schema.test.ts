import { describe, expect, it } from "vitest";
import { ProjectConfig, variantIdFor } from "./schema.ts";

describe("variantIdFor", () => {
  it("maps framework + layout to variant ids", () => {
    expect(variantIdFor("nextjs", "monorepo")).toBe("nextjs-monorepo");
    expect(variantIdFor("nextjs", "single")).toBe("nextjs-single");
    expect(variantIdFor("tanstack", "monorepo")).toBe("tanstack-monorepo");
    expect(variantIdFor("tanstack", "single")).toBe("tanstack-single");
  });
});

describe("ProjectConfig", () => {
  const valid = {
    name: "my-app",
    targetDir: "/tmp/my-app",
    framework: "nextjs" as const,
    layout: "monorepo" as const,
    features: [],
    packageManager: "pnpm" as const,
    install: false,
    git: false,
  };

  it("accepts a kebab-case name", () => {
    expect(ProjectConfig.safeParse(valid).success).toBe(true);
  });

  it("rejects upper-case names", () => {
    const result = ProjectConfig.safeParse({ ...valid, name: "MyApp" });
    expect(result.success).toBe(false);
  });

  it("rejects better-auth without convex", () => {
    const result = ProjectConfig.safeParse({
      ...valid,
      features: ["better-auth", "shadcn"],
      shadcn: { preset: "default", components: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects better-auth without shadcn", () => {
    const result = ProjectConfig.safeParse({
      ...valid,
      features: ["better-auth", "convex"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects shadcn feature without shadcn config", () => {
    const result = ProjectConfig.safeParse({
      ...valid,
      features: ["shadcn"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts shadcn with a config block", () => {
    const result = ProjectConfig.safeParse({
      ...valid,
      features: ["shadcn"],
      shadcn: { preset: "default", components: [] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts convex + better-auth + shadcn together", () => {
    const result = ProjectConfig.safeParse({
      ...valid,
      features: ["convex", "better-auth", "shadcn"],
      shadcn: { preset: "default", components: [] },
    });
    expect(result.success).toBe(true);
  });
});
