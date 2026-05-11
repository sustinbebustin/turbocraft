import pc from "picocolors";

export const theme = {
  brand: (s: string) => pc.cyan(pc.bold(s)),
  accent: (s: string) => pc.magenta(s),
  muted: (s: string) => pc.dim(s),
  ok: (s: string) => pc.green(s),
  warn: (s: string) => pc.yellow(s),
  err: (s: string) => pc.red(s),
  code: (s: string) => pc.cyan(s),
};
