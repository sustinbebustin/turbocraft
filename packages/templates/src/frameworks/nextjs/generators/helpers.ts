import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function readApps(repoRoot: string): string[] {
  const appsDir = join(repoRoot, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir)
    .filter((entry) => {
      const dir = join(appsDir, entry);
      return (
        statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))
      );
    })
    .sort();
}

export function isKebabCase(value: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value);
}

const RESERVED_APP_NAMES = new Set(["node_modules", "_template"]);

export function isReservedAppName(value: string): boolean {
  return RESERVED_APP_NAMES.has(value);
}

export function isValidRoutePath(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/") || value.endsWith("/")) return false;
  if (value.includes("..")) return false;
  return /^[A-Za-z0-9_\-/()[\]@.]+$/.test(value);
}

export function nameFromRoutePath(routePath: string): string {
  const segments = routePath.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (!seg) continue;
    if (seg.startsWith("(") && seg.endsWith(")")) continue;
    if (seg.startsWith("[") && seg.endsWith("]")) continue;
    return seg.toLowerCase();
  }
  return "page";
}
