import { Effect, Context, Layer } from "effect";
import { NetworkError } from "../domain/errors.ts";

const REGISTRY_INDEX_URL = "https://ui.shadcn.com/r/index.json";
const FETCH_TIMEOUT_MS = 5_000;

type RegistryItem = {
  readonly name?: unknown;
  readonly type?: unknown;
};

export class ShadcnRegistry extends Context.Tag("ShadcnRegistry")<
  ShadcnRegistry,
  {
    readonly fetchComponentNames: () => Effect.Effect<
      ReadonlyArray<string>,
      NetworkError
    >;
  }
>() {}

const live = ShadcnRegistry.of({
  fetchComponentNames: () =>
    Effect.tryPromise({
      try: async () => {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch(REGISTRY_INDEX_URL, { signal: ac.signal });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          const body = (await res.json()) as ReadonlyArray<RegistryItem>;
          if (!Array.isArray(body)) {
            throw new Error("Registry index did not return an array.");
          }
          const names: string[] = [];
          for (const item of body) {
            if (
              typeof item.name === "string" &&
              item.type === "registry:ui" &&
              item.name.length > 0
            ) {
              names.push(item.name);
            }
          }
          names.sort();
          return names;
        } finally {
          clearTimeout(t);
        }
      },
      catch: (cause) => new NetworkError({ url: REGISTRY_INDEX_URL, cause }),
    }).pipe(Effect.withSpan("ShadcnRegistry.fetchComponentNames")),
});

export const ShadcnRegistryLive = Layer.succeed(ShadcnRegistry, live);
