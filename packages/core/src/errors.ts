import { Data } from "effect";

export class TargetExistsError extends Data.TaggedError("TargetExistsError")<{
  readonly path: string;
}> {}

export class CopyError extends Data.TaggedError("CopyError")<{
  readonly from: string;
  readonly to: string;
  readonly cause: unknown;
}> {}

export class GeneratorError extends Data.TaggedError("GeneratorError")<{
  readonly generator: string;
  readonly variant: string;
  readonly cause: unknown;
}> {}

export class ManifestError extends Data.TaggedError("ManifestError")<{
  readonly variant: string;
  readonly message: string;
}> {}

export type CoreError =
  | TargetExistsError
  | CopyError
  | GeneratorError
  | ManifestError;
