import { Effect, Context, Layer } from "effect";
import { x } from "tinyexec";
import { SpawnError } from "../domain/errors.ts";

export type RunOptions = {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
};

export class ProcessService extends Context.Tag("ProcessService")<
  ProcessService,
  {
    readonly run: (
      command: string,
      args: ReadonlyArray<string>,
      options: RunOptions
    ) => Effect.Effect<
      { readonly stdout: string; readonly stderr: string },
      SpawnError
    >;
  }
>() {}

const live = ProcessService.of({
  run: (command, args, options) =>
    Effect.tryPromise({
      try: async () => {
        const proc = x(command, [...args], {
          nodeOptions: {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
          },
        });
        const result = await proc;
        if (result.exitCode !== undefined && result.exitCode !== 0) {
          throw new SpawnError({
            command: `${command} ${args.join(" ")}`,
            exitCode: result.exitCode,
            stderr: result.stderr ?? "",
          });
        }
        return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
      },
      catch: (cause) =>
        cause instanceof SpawnError
          ? cause
          : new SpawnError({
              command: `${command} ${args.join(" ")}`,
              exitCode: null,
              stderr: cause instanceof Error ? cause.message : String(cause),
            }),
    }),
});

export const ProcessLive = Layer.succeed(ProcessService, live);
