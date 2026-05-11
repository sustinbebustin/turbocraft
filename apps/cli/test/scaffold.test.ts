import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "@turbocraft/core";
import { scaffold } from "../src/operations/scaffold.ts";
import { FileSystemLive } from "../src/services/FileSystem.ts";
import { PlopLive } from "../src/services/Plop.ts";
import { PackageManagerLive } from "../src/services/PackageManager.ts";
import { ProcessLive } from "../src/services/Process.ts";
import { TemplatesLive } from "../src/services/Templates.ts";

const Layers = Layer.mergeAll(
  FileSystemLive,
  PackageManagerLive.pipe(Layer.provide(ProcessLive)),
  ProcessLive,
  PlopLive,
  TemplatesLive
);

const runScaffold = (config: ProjectConfig) =>
  Effect.runPromise(scaffold(config).pipe(Effect.provide(Layers)));

describe("scaffold nextjs-monorepo (default options)", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("emits a complete repo with apps/web and turbo/generators", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "nextjs",
      layout: "monorepo",
      features: [],
      packageManager: "pnpm",
      install: false,
      git: false,
    };

    const report = await runScaffold(config);
    expect(report.variant).toBe("nextjs-monorepo");
    expect(report.installed).toBe(false);
    expect(report.gitInitialised).toBe(false);

    const expected = [
      "package.json",
      "pnpm-workspace.yaml",
      "turbo.json",
      "tsconfig.json",
      ".oxlintrc.json",
      ".gitignore",
      "knip.json",
      "apps/web/package.json",
      "apps/web/app/page.tsx",
      "apps/web/app/layout.tsx",
      "packages/typescript-config/base.json",
      "turbo/generators/config.ts",
      "turbo/generators/templates/app/package.json.hbs",
    ];
    for (const rel of expected) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }

    const webPkg = JSON.parse(
      await readFile(join(target, "apps/web/package.json"), "utf8")
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(webPkg.name).toBe("web");
    expect(webPkg.dependencies?.["next"]).toBeDefined();
    // Convex/better-auth must be absent when no features selected.
    expect(webPkg.dependencies?.["convex"]).toBeUndefined();
    expect(webPkg.dependencies?.["better-auth"]).toBeUndefined();
    expect(webPkg.dependencies?.["@convex-dev/better-auth"]).toBeUndefined();
    expect(webPkg.scripts?.["dev:convex"]).toBeUndefined();
    expect(existsSync(join(target, "apps/web/convex"))).toBe(false);
    expect(existsSync(join(target, "apps/web/lib/auth-server.ts"))).toBe(false);
    expect(
      existsSync(join(target, "apps/web/components/convex-client-provider.tsx"))
    ).toBe(false);
  });
});

describe("scaffold tanstack-monorepo (default options)", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("emits a complete tanstack repo with apps/web/src/router.tsx", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "tanstack",
      layout: "monorepo",
      features: [],
      packageManager: "pnpm",
      install: false,
      git: false,
    };

    const report = await runScaffold(config);
    expect(report.variant).toBe("tanstack-monorepo");

    const expected = [
      "package.json",
      "pnpm-workspace.yaml",
      "turbo.json",
      "apps/web/package.json",
      "apps/web/vite.config.ts",
      "apps/web/src/router.tsx",
      "apps/web/src/routes/__root.tsx",
      "apps/web/src/routes/index.tsx",
      "turbo/generators/config.ts",
    ];
    for (const rel of expected) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }

    const webPkg = JSON.parse(
      await readFile(join(target, "apps/web/package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
    expect(webPkg.dependencies?.["convex"]).toBeUndefined();
    expect(webPkg.dependencies?.["@convex-dev/react-query"]).toBeUndefined();
    expect(webPkg.dependencies?.["better-auth"]).toBeUndefined();
    expect(existsSync(join(target, "apps/web/convex"))).toBe(false);
    expect(existsSync(join(target, "apps/web/src/lib/auth-server.ts"))).toBe(
      false
    );

    const router = await readFile(
      join(target, "apps/web/src/router.tsx"),
      "utf8"
    );
    expect(router).not.toContain("ConvexQueryClient");
  });
});

describe("scaffold tanstack-monorepo with convex + better-auth", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("layers convex + better-auth into apps/web/", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "tanstack",
      layout: "monorepo",
      features: ["shadcn", "convex", "better-auth"],
      shadcn: { preset: "default", components: [] },
      packageManager: "pnpm",
      install: false,
      git: false,
    };
    await runScaffold(config);

    const expected = [
      "apps/web/convex/schema.ts",
      "apps/web/convex/auth.ts",
      "apps/web/src/lib/auth-client.ts",
      "apps/web/src/lib/auth-server.ts",
      "apps/web/src/routes/api/auth.$.ts",
    ];
    for (const rel of expected) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }

    const webPkg = JSON.parse(
      await readFile(join(target, "apps/web/package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(webPkg.dependencies?.["convex"]).toBe("catalog:");
    expect(webPkg.dependencies?.["@convex-dev/react-query"]).toBe("catalog:");
    expect(webPkg.dependencies?.["better-auth"]).toBe("catalog:");
    expect(webPkg.dependencies?.["@convex-dev/better-auth"]).toBe("catalog:");
    expect(webPkg.scripts?.["dev:convex"]).toBe("convex dev");

    const router = await readFile(
      join(target, "apps/web/src/router.tsx"),
      "utf8"
    );
    expect(router).toContain("ConvexQueryClient");
  });
});

describe("scaffold nextjs-single (no features)", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("emits a Next.js single-app project at the root with no feature files", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "nextjs",
      layout: "single",
      features: [],
      packageManager: "pnpm",
      install: false,
      git: false,
    };
    const report = await runScaffold(config);
    expect(report.variant).toBe("nextjs-single");

    for (const rel of [
      "package.json",
      "next.config.ts",
      "tsconfig.json",
      "app/page.tsx",
      "app/layout.tsx",
      ".oxlintrc.json",
      "vitest.config.ts",
    ]) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }
    // Single-app projects are not turborepos.
    expect(existsSync(join(target, "turbo/generators"))).toBe(false);
    expect(existsSync(join(target, "pnpm-workspace.yaml"))).toBe(false);

    // shadcn opt-out: no theme-provider, no components.json, no shadcn deps.
    expect(existsSync(join(target, "components/theme-provider.tsx"))).toBe(
      false
    );
    expect(existsSync(join(target, "components.json"))).toBe(false);
    expect(existsSync(join(target, "components/ui"))).toBe(false);

    // Feature opt-out: no convex/, no better-auth files, no feature deps.
    expect(existsSync(join(target, "convex"))).toBe(false);
    expect(
      existsSync(join(target, "components/convex-client-provider.tsx"))
    ).toBe(false);
    expect(existsSync(join(target, "lib/auth-client.ts"))).toBe(false);
    expect(existsSync(join(target, "lib/auth-server.ts"))).toBe(false);
    expect(existsSync(join(target, "app/(unauth)"))).toBe(false);

    const pkg = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as { name: string; dependencies?: Record<string, string> };
    expect(pkg.name).toBe("my-app");
    expect(pkg.dependencies?.["next"]).toBeDefined();
    expect(pkg.dependencies?.["convex"]).toBeUndefined();
    expect(pkg.dependencies?.["better-auth"]).toBeUndefined();
    expect(pkg.dependencies?.["@convex-dev/better-auth"]).toBeUndefined();

    // The async layout / convex provider wrapping is only present when
    // the relevant features are enabled.
    const layout = await readFile(join(target, "app/layout.tsx"), "utf8");
    expect(layout).not.toContain("ConvexClientProvider");
    expect(layout).not.toContain("async function RootLayout");
  });
});

describe("scaffold nextjs-single with convex + better-auth", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("layers convex + better-auth on top of the base nextjs-single project", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "nextjs",
      layout: "single",
      features: ["shadcn", "convex", "better-auth"],
      shadcn: { preset: "default", components: [] },
      packageManager: "pnpm",
      install: false,
      git: false,
    };
    await runScaffold(config);

    for (const rel of [
      "convex/schema.ts",
      "convex/auth.ts",
      "components/convex-client-provider.tsx",
      "lib/auth-client.ts",
      "lib/auth-server.ts",
      "app/(unauth)/sign-in/page.tsx",
      "app/reset-password/page.tsx",
    ]) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }

    const pkg = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.["convex"]).toBeDefined();
    expect(pkg.dependencies?.["better-auth"]).toBeDefined();
    expect(pkg.dependencies?.["@convex-dev/better-auth"]).toBeDefined();
    expect(pkg.scripts?.["dev:convex"]).toBe("convex dev");
    expect(pkg.scripts?.["dev"]).toBe(
      'convex dev --start "next dev --turbopack"'
    );

    // Both feature flags wired through to the templated layout.
    const layout = await readFile(join(target, "app/layout.tsx"), "utf8");
    expect(layout).toContain("ConvexClientProvider");
    expect(layout).toContain("async function RootLayout");
    expect(layout).toContain("initialToken={token}");
  });
});

describe("scaffold tanstack-single (no features)", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("emits a TanStack Start single-app project at the root with no feature files", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "tanstack",
      layout: "single",
      features: [],
      packageManager: "pnpm",
      install: false,
      git: false,
    };
    const report = await runScaffold(config);
    expect(report.variant).toBe("tanstack-single");

    for (const rel of [
      "package.json",
      "vite.config.ts",
      "tsconfig.json",
      "src/router.tsx",
      "src/routes/__root.tsx",
      "src/routes/index.tsx",
      ".oxlintrc.json",
      "vitest.config.ts",
    ]) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }
    expect(existsSync(join(target, "turbo/generators"))).toBe(false);
    expect(existsSync(join(target, "pnpm-workspace.yaml"))).toBe(false);

    // shadcn opt-out: no theme-provider, no components.json, no shadcn deps.
    expect(existsSync(join(target, "src/components/theme-provider.tsx"))).toBe(
      false
    );
    expect(existsSync(join(target, "components.json"))).toBe(false);
    expect(existsSync(join(target, "src/components/ui"))).toBe(false);

    // Feature opt-out
    expect(existsSync(join(target, "convex"))).toBe(false);
    expect(existsSync(join(target, "src/lib/auth-client.ts"))).toBe(false);
    expect(existsSync(join(target, "src/routes/api/auth.$.ts"))).toBe(false);
    expect(existsSync(join(target, "src/routes/_unauth.tsx"))).toBe(false);

    const pkg = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("my-app");
    expect(pkg.dependencies?.["@tanstack/react-router"]).toBeDefined();
    expect(pkg.dependencies?.["convex"]).toBeUndefined();
    expect(pkg.dependencies?.["better-auth"]).toBeUndefined();
    expect(pkg.scripts?.["dev:convex"]).toBeUndefined();

    // Templated router.tsx should not contain Convex bits when convex is off.
    const router = await readFile(join(target, "src/router.tsx"), "utf8");
    expect(router).not.toContain("ConvexQueryClient");
    expect(router).not.toContain("ConvexProvider");

    // Templated __root.tsx should not contain better-auth bits when off.
    const root = await readFile(join(target, "src/routes/__root.tsx"), "utf8");
    expect(root).not.toContain("ConvexBetterAuthProvider");
    expect(root).not.toContain("createServerFn");
  });
});

describe("scaffold tanstack-single with convex + better-auth", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("layers convex + better-auth on top of the base tanstack-single project", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "tanstack",
      layout: "single",
      features: ["shadcn", "convex", "better-auth"],
      shadcn: { preset: "default", components: [] },
      packageManager: "pnpm",
      install: false,
      git: false,
    };
    await runScaffold(config);

    for (const rel of [
      "convex/schema.ts",
      "convex/auth.ts",
      "src/lib/auth-client.ts",
      "src/lib/auth-server.ts",
      "src/routes/_unauth.tsx",
      "src/routes/_unauth/sign-in.tsx",
      "src/routes/reset-password.tsx",
      "src/routes/api/auth.$.ts",
    ]) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }

    const pkg = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.["convex"]).toBeDefined();
    expect(pkg.dependencies?.["better-auth"]).toBeDefined();
    expect(pkg.dependencies?.["@convex-dev/better-auth"]).toBeDefined();
    expect(pkg.scripts?.["dev:convex"]).toBe("convex dev");
    expect(pkg.scripts?.["dev"]).toBe('convex dev --start "vite dev"');

    const router = await readFile(join(target, "src/router.tsx"), "utf8");
    expect(router).toContain("ConvexQueryClient");
    expect(router).toContain("ConvexProvider");

    const root = await readFile(join(target, "src/routes/__root.tsx"), "utf8");
    expect(root).toContain("ConvexBetterAuthProvider");
    expect(root).toContain("createServerFn");
  });
});

describe("scaffold nextjs-monorepo with convex + better-auth", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("emits convex/ and lib/auth-*.ts when both features are on", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "nextjs",
      layout: "monorepo",
      features: ["shadcn", "convex", "better-auth"],
      shadcn: { preset: "default", components: [] },
      packageManager: "pnpm",
      install: false,
      git: false,
    };
    await runScaffold(config);

    const expected = [
      "apps/web/convex/schema.ts",
      "apps/web/convex/auth.ts",
      "apps/web/lib/auth-client.ts",
      "apps/web/lib/auth-server.ts",
      "apps/web/app/api/auth/[...all]/route.ts",
      "apps/web/components/convex-client-provider.tsx",
    ];
    for (const rel of expected) {
      expect(existsSync(join(target, rel)), `missing ${rel}`).toBe(true);
    }

    const webPkg = JSON.parse(
      await readFile(join(target, "apps/web/package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(webPkg.dependencies?.["convex"]).toBe("catalog:");
    expect(webPkg.dependencies?.["better-auth"]).toBe("catalog:");
    expect(webPkg.dependencies?.["@convex-dev/better-auth"]).toBe("catalog:");
    expect(webPkg.scripts?.["dev:convex"]).toBe("convex dev");

    const layout = await readFile(
      join(target, "apps/web/app/layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("ConvexClientProvider");
    expect(layout).toContain("getToken");
  });
});

describe("scaffold refuses to write into a non-empty directory", () => {
  let target: string;

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), "turbocraft-test-"));
    target = join(root, "my-app");
    await writeFile(join(root, "placeholder.txt"), "noise\n");
    // Use the root itself so it's guaranteed non-empty.
    target = root;
  });

  afterAll(async () => {
    if (target) await rm(target, { recursive: true, force: true });
  });

  it("fails with TargetDirNotEmpty listing the conflicts", async () => {
    const config: ProjectConfig = {
      name: "my-app",
      targetDir: target,
      framework: "nextjs",
      layout: "monorepo",
      features: [],
      packageManager: "pnpm",
      install: false,
      git: false,
    };

    const exit = await Effect.runPromiseExit(
      scaffold(config).pipe(Effect.provide(Layers))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) return;
    const failure = Cause.failureOption(exit.cause);
    expect(failure._tag).toBe("Some");
    if (failure._tag !== "Some") return;
    expect(failure.value._tag).toBe("TargetDirNotEmpty");
    if (failure.value._tag !== "TargetDirNotEmpty") return;
    expect(failure.value.path).toBe(target);
    expect(failure.value.conflicts).toContain("placeholder.txt");
  });
});
