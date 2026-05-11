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
      features: ["better-auth"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts convex + better-auth together", () => {
    const result = ProjectConfig.safeParse({
      ...valid,
      features: ["convex", "better-auth"],
    });
    expect(result.success).toBe(true);
  });
});
