import { Effect } from "effect";
import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, sep } from "node:path";
import type { ProjectConfig } from "@turbocraft/core";
import { ProcessService } from "../services/Process.ts";
import { FsError } from "../domain/errors.ts";

export type ConvexSetupReport = {
  /** True when `convex dev --once` completed and wrote URL+deployment. */
  readonly convexConfigured: boolean;
  /** True when BETTER_AUTH_SECRET was set on the Convex deployment. */
  readonly betterAuthSecretSet: boolean;
  /** True when *_CONVEX_SITE_URL was computed and written to .env.local. */
  readonly siteUrlWritten: boolean;
  /**
   * If setup was skipped or partially failed, a short reason for the outro
   * to show alongside fallback commands. Absent on full success.
   */
  readonly skippedReason?: string;
};

const SKIPPED_NOT_REQUESTED: ConvexSetupReport = {
  convexConfigured: false,
  betterAuthSecretSet: false,
  siteUrlWritten: false,
};

const convexCwdFor = (config: ProjectConfig): string =>
  config.layout === "monorepo"
    ? join(config.targetDir, "apps", "web")
    : config.targetDir;

const convexUrlEnvVar = (config: ProjectConfig): string =>
  config.framework === "nextjs" ? "NEXT_PUBLIC_CONVEX_URL" : "VITE_CONVEX_URL";

const convexSiteUrlEnvVar = (config: ProjectConfig): string =>
  config.framework === "nextjs"
    ? "NEXT_PUBLIC_CONVEX_SITE_URL"
    : "VITE_CONVEX_SITE_URL";

const parseEnvValue = (content: string, key: string): string | undefined => {
  for (const raw of content.split(/\r?\n/u)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    if (line.slice(0, eq).trim() !== key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
};

const setEnvLine = (content: string, key: string, value: string): string => {
  const lines = content.split(/\r?\n/u);
  let replaced = false;
  const next = lines.map((raw) => {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) return raw;
    const eq = line.indexOf("=");
    if (eq < 0) return raw;
    if (line.slice(0, eq).trim() !== key) return raw;
    replaced = true;
    return `${key}=${value}`;
  });
  if (!replaced) {
    if (next.length > 0 && next[next.length - 1] !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  if (next[next.length - 1] !== "") next.push("");
  return next.join("\n");
};

// Convex deployments expose two hosts: <name>.convex.cloud (API) and
// <name>.convex.site (HTTP actions, used for OAuth callbacks).
const toSiteUrl = (cloudUrl: string): string =>
  cloudUrl.replace(/\.convex\.cloud(\/|$)/u, ".convex.site$1");

const convexBinPath = (convexCwd: string): string =>
  join(convexCwd, "node_modules", ".bin", "convex");

const seedEnvLocal = (convexCwd: string): Effect.Effect<void, FsError> =>
  Effect.tryPromise({
    try: async () => {
      const example = join(convexCwd, ".env.example");
      const local = join(convexCwd, ".env.local");
      if (existsSync(local) || !existsSync(example)) return;
      await copyFile(example, local);
    },
    catch: (cause) =>
      new FsError({ op: "copyEnvExample", path: convexCwd, cause }),
  });

const writeSiteUrl = (
  config: ProjectConfig,
  convexCwd: string
): Effect.Effect<boolean, FsError> =>
  Effect.tryPromise({
    try: async () => {
      const envPath = join(convexCwd, ".env.local");
      if (!existsSync(envPath)) return false;
      const original = await readFile(envPath, "utf8");
      const urlKey = convexUrlEnvVar(config);
      const siteKey = convexSiteUrlEnvVar(config);
      const url = parseEnvValue(original, urlKey);
      if (url === undefined || url.length === 0) return false;
      const existing = parseEnvValue(original, siteKey);
      if (existing !== undefined && existing.length > 0) return true;
      const next = setEnvLine(original, siteKey, toSiteUrl(url));
      if (next === original) return false;
      await writeFile(envPath, next, "utf8");
      return true;
    },
    catch: (cause) =>
      new FsError({ op: "writeSiteUrl", path: convexCwd, cause }),
  });

/**
 * Run a one-time Convex setup after dependencies are installed:
 *
 *   1. Seed `.env.local` from `.env.example` (idempotent).
 *   2. `convex dev --once` — interactive. Convex itself prompts the user to
 *      choose "Start without an account (local)" vs "Login or create an
 *      account"; only the latter opens a browser. Writes CONVEX_DEPLOYMENT
 *      and the framework's CONVEX_URL into `.env.local`, runs codegen.
 *   3. Derive *_CONVEX_SITE_URL from the URL and append it to `.env.local`.
 *   4. If better-auth: generate a base64 secret and `convex env set` it.
 *
 * Best-effort: any step's failure short-circuits and returns a populated
 * `skippedReason` so the outro can print fallback commands. The repo is
 * always left in a runnable state — the user can finish by hand.
 */
export const setupConvex = (
  config: ProjectConfig
): Effect.Effect<ConvexSetupReport, never, ProcessService> => {
  if (!config.install || !config.features.includes("convex")) {
    return Effect.succeed(SKIPPED_NOT_REQUESTED);
  }
  const convexCwd = convexCwdFor(config);
  const bin = convexBinPath(convexCwd);
  const wantsBetterAuth = config.features.includes("better-auth");

  return Effect.gen(function* () {
    const proc = yield* ProcessService;

    if (!existsSync(bin)) {
      return {
        ...SKIPPED_NOT_REQUESTED,
        skippedReason: `convex binary not found at .${sep}node_modules${sep}.bin${sep}convex (dependency install may have failed).`,
      };
    }

    yield* seedEnvLocal(convexCwd).pipe(Effect.ignore);

    const configured = yield* proc
      .run(bin, ["dev", "--once"], {
        cwd: convexCwd,
        interactive: true,
      })
      .pipe(
        Effect.as(true),
        Effect.catchTag("SpawnError", () => Effect.succeed(false))
      );

    if (!configured) {
      return {
        convexConfigured: false,
        betterAuthSecretSet: false,
        siteUrlWritten: false,
        skippedReason: "convex dev --once did not complete.",
      };
    }

    const siteUrlWritten = yield* writeSiteUrl(config, convexCwd).pipe(
      Effect.catchTag("FsError", () => Effect.succeed(false))
    );

    let betterAuthSecretSet = false;
    if (wantsBetterAuth) {
      const secret = randomBytes(32).toString("base64");
      betterAuthSecretSet = yield* proc
        .run(bin, ["env", "set", "BETTER_AUTH_SECRET", secret], {
          cwd: convexCwd,
          interactive: true,
        })
        .pipe(
          Effect.as(true),
          Effect.catchTag("SpawnError", () => Effect.succeed(false))
        );
    }

    return {
      convexConfigured: true,
      betterAuthSecretSet,
      siteUrlWritten,
      ...(wantsBetterAuth && !betterAuthSecretSet
        ? { skippedReason: "Better Auth secret was not set on Convex." }
        : {}),
    };
  });
};
