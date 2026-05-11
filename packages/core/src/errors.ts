import { Schema } from "effect";

export class ManifestError extends Schema.TaggedError<ManifestError>()(
  "ManifestError",
  {
    variant: Schema.String,
    message: Schema.String,
  }
) {}
