import { Layer } from "effect";
import { FileSystemLive } from "./FileSystem.ts";
import { PackageManagerLive } from "./PackageManager.ts";
import { PlopLive } from "./Plop.ts";
import { ProcessLive } from "./Process.ts";
import { ShadcnRegistryLive } from "./ShadcnRegistry.ts";
import { TemplatesLive } from "./Templates.ts";

export const MainLive = PackageManagerLive.pipe(
  Layer.provideMerge(ProcessLive),
  Layer.provideMerge(FileSystemLive),
  Layer.provideMerge(PlopLive),
  Layer.provideMerge(ShadcnRegistryLive),
  Layer.provideMerge(TemplatesLive),
);
