import { describe, expect, it } from "@effect/vitest";
import fc from "fast-check";
import {
  ProjectConfig,
  ProjectName,
  variantIdFor,
  type Feature,
} from "./schema.ts";

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

const lowerAlnum = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789");
const segment = fc
  .array(lowerAlnum, { minLength: 1, maxLength: 10 })
  .map((cs) => cs.join(""));
const kebabCase = fc
  .tuple(
    segment.filter((s) => /^[a-z]/u.test(s)),
    fc.array(segment, { minLength: 0, maxLength: 5 })
  )
  .map(([head, rest]) => [head, ...rest].join("-"));

describe("ProjectName (property)", () => {
  it("accepts all valid kebab-case names", () => {
    fc.assert(
      fc.property(kebabCase, (name) => {
        expect(ProjectName.safeParse(name).success).toBe(true);
      })
    );
  });

  it("rejects any name containing uppercase letters", () => {
    const mixedChar = fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef");
    const withUpper = fc
      .array(mixedChar, { minLength: 1, maxLength: 20 })
      .map((cs) => cs.join(""))
      .filter((s) => /[A-Z]/u.test(s));
    fc.assert(
      fc.property(withUpper, (name) => {
        expect(ProjectName.safeParse(name).success).toBe(false);
      })
    );
  });

  it("rejects empty strings", () => {
    expect(ProjectName.safeParse("").success).toBe(false);
  });
});

describe("ProjectConfig feature constraints (property)", () => {
  const baseConfig = {
    name: "my-app",
    targetDir: "/tmp/my-app",
    framework: "nextjs" as const,
    layout: "monorepo" as const,
    packageManager: "pnpm" as const,
    install: false,
    git: false,
  };

  it("better-auth without convex always fails", () => {
    const featuresWithoutConvex = fc
      .subarray<Feature>(["shadcn", "better-auth"])
      .filter((fs) => fs.includes("better-auth") && !fs.includes("convex"));
    fc.assert(
      fc.property(featuresWithoutConvex, (features) => {
        const result = ProjectConfig.safeParse({
          ...baseConfig,
          features: [...features],
          shadcn: features.includes("shadcn")
            ? { preset: "default", components: [] }
            : undefined,
        });
        expect(result.success).toBe(false);
      })
    );
  });

  it("better-auth without shadcn always fails", () => {
    const featuresWithoutShadcn = fc
      .subarray<Feature>(["convex", "better-auth"])
      .filter((fs) => fs.includes("better-auth") && !fs.includes("shadcn"));
    fc.assert(
      fc.property(featuresWithoutShadcn, (features) => {
        const result = ProjectConfig.safeParse({
          ...baseConfig,
          features: [...features],
        });
        expect(result.success).toBe(false);
      })
    );
  });

  it("shadcn feature without config always fails", () => {
    const featuresWithShadcn = fc
      .subarray<Feature>(["shadcn", "convex", "better-auth"])
      .filter((fs) => fs.includes("shadcn"));
    fc.assert(
      fc.property(featuresWithShadcn, (features) => {
        const result = ProjectConfig.safeParse({
          ...baseConfig,
          features: [...features],
        });
        expect(result.success).toBe(false);
      })
    );
  });
});
