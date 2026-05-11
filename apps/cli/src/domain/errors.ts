import { Schema } from "effect";
import { ManifestError } from "@turbocraft/core";

export class UserCancelled extends Schema.TaggedError<UserCancelled>()(
  "UserCancelled",
  { stage: Schema.String }
) {}

export class InvalidConfig extends Schema.TaggedError<InvalidConfig>()(
  "InvalidConfig",
  { issues: Schema.Array(Schema.String) }
) {}

export class FsError extends Schema.TaggedError<FsError>()(
  "FsError",
  {
    op: Schema.String,
    path: Schema.String,
    cause: Schema.Defect,
  }
) {}

export class TargetDirNotEmpty extends Schema.TaggedError<TargetDirNotEmpty>()(
  "TargetDirNotEmpty",
  {
    path: Schema.String,
    conflicts: Schema.Array(Schema.String),
  }
) {}

export class SpawnError extends Schema.TaggedError<SpawnError>()(
  "SpawnError",
  {
    command: Schema.String,
    exitCode: Schema.NullOr(Schema.Number),
    stderr: Schema.String,
  }
) {}

export class PlopError extends Schema.TaggedError<PlopError>()(
  "PlopError",
  {
    variant: Schema.String,
    generator: Schema.String,
    cause: Schema.Defect,
  }
) {}

export class WizardError extends Schema.TaggedError<WizardError>()(
  "WizardError",
  {
    stage: Schema.optional(Schema.String),
    cause: Schema.Defect,
  }
) {}

export class NetworkError extends Schema.TaggedError<NetworkError>()(
  "NetworkError",
  {
    url: Schema.String,
    cause: Schema.Defect,
  }
) {}

export class PathEscape extends Schema.TaggedError<PathEscape>()(
  "PathEscape",
  {
    label: Schema.String,
    parent: Schema.String,
    child: Schema.String,
  }
) {}

export class MergeParseError extends Schema.TaggedError<MergeParseError>()(
  "MergeParseError",
  {
    src: Schema.String,
    cause: Schema.Defect,
  }
) {}

export type CliError =
  | UserCancelled
  | InvalidConfig
  | FsError
  | TargetDirNotEmpty
  | SpawnError
  | PlopError
  | WizardError
  | NetworkError
  | PathEscape
  | MergeParseError
  | ManifestError;
