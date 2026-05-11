import { Data } from "effect";

export class UserCancelled extends Data.TaggedError("UserCancelled")<{
  readonly stage: string;
}> {}

export class InvalidConfig extends Data.TaggedError("InvalidConfig")<{
  readonly issues: ReadonlyArray<string>;
}> {}

export class FsError extends Data.TaggedError("FsError")<{
  readonly op: string;
  readonly path: string;
  readonly cause: unknown;
}> {}

export class TargetDirNotEmpty extends Data.TaggedError("TargetDirNotEmpty")<{
  readonly path: string;
  readonly conflicts: ReadonlyArray<string>;
}> {}

export class SpawnError extends Data.TaggedError("SpawnError")<{
  readonly command: string;
  readonly exitCode: number | null;
  readonly stderr: string;
}> {}

export class PlopError extends Data.TaggedError("PlopError")<{
  readonly variant: string;
  readonly generator: string;
  readonly cause: unknown;
}> {}

export class WizardError extends Data.TaggedError("WizardError")<{
  readonly cause: unknown;
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly url: string;
  readonly cause: unknown;
}> {}

export type CliError =
  | UserCancelled
  | InvalidConfig
  | FsError
  | TargetDirNotEmpty
  | SpawnError
  | PlopError
  | WizardError
  | NetworkError;
