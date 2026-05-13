import { Cause, Effect, Exit, Option } from "effect";
import { theme } from "../ui/theme.ts";
import type { CliError } from "../domain/errors.ts";

const formatTargetDirNotEmpty = (
  path: string,
  conflicts: ReadonlyArray<string>
): string => {
  const header = `Target directory ${theme.code(path)} is not empty.`;
  const list = conflicts.map((name) => `  ${name}`).join("\n");
  const hint =
    `Pick a different project name, or remove the existing directory:\n` +
    `  ${theme.code(`rm -rf ${path}`)}`;
  return [theme.err(header), list, "", hint].join("\n");
};

const describeError = (err: CliError): string => {
  switch (err._tag) {
    case "FsError":
      return `${err.op} at ${err.path}: ${String(err.cause)}`;
    case "SpawnError":
      return err.exitCode !== null
        ? `'${err.command}' exited with ${err.exitCode}${err.stderr.length > 0 ? `: ${err.stderr}` : ""}`
        : `'${err.command}' failed: ${err.stderr}`;
    case "PlopError":
      return `generator '${err.generator}' (${err.variant}): ${String(err.cause)}`;
    case "WizardError":
      return String(err.cause);
    case "NetworkError":
      return `${err.url}: ${String(err.cause)}`;
    case "ManifestError":
      return `variant '${err.variant}': ${err.message}`;
    case "PathEscape":
      return `${err.label}: resolved path '${err.child}' escapes '${err.parent}'`;
    case "MergeParseError":
      return `failed to parse merge layer '${err.src}': ${String(err.cause)}`;
    default:
      return "";
  }
};

const renderCliError = (
  err: CliError
): { readonly code: number; readonly message: string } => {
  switch (err._tag) {
    case "UserCancelled":
      return { code: 1, message: "" };
    case "TargetDirNotEmpty":
      return {
        code: 1,
        message: formatTargetDirNotEmpty(err.path, err.conflicts),
      };
    case "InvalidConfig":
      return {
        code: 1,
        message: [
          theme.err("Invalid configuration:"),
          ...err.issues.map((i) => theme.err(`  - ${i}`)),
        ].join("\n"),
      };
    case "FsError":
    case "SpawnError":
    case "PlopError":
    case "WizardError":
    case "NetworkError":
    case "ManifestError":
    case "PathEscape":
    case "MergeParseError":
      return {
        code: 1,
        message: theme.err(`${err._tag}: ${describeError(err)}`),
      };
  }
};

export const runCli = <A>(
  program: Effect.Effect<A, CliError, never>
): Promise<A | void> =>
  Effect.runPromiseExit(program).then((exit) => {
    if (Exit.isSuccess(exit)) return exit.value;
    const failure = Cause.failureOption(exit.cause);
    if (Option.isSome(failure)) {
      const { code, message } = renderCliError(failure.value);
      if (message.length > 0) console.error(message);
      process.exitCode = code;
      return;
    }
    console.error(theme.err(Cause.pretty(exit.cause)));
    process.exitCode = 1;
  });
