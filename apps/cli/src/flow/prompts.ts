import { Effect } from "effect";
import {
  text,
  select,
  confirm,
  multiselect,
  isCancel,
  cancel,
} from "@clack/prompts";
import { UserCancelled, WizardError } from "../domain/errors.ts";

type TextOptions = Parameters<typeof text>[0];
type SelectOptions<V> = Parameters<typeof select<V>>[0];
type ConfirmOptions = Parameters<typeof confirm>[0];
type MultiselectOptions<V> = Parameters<typeof multiselect<V>>[0];

const wrapPrompt = <A>(
  stage: string,
  promise: () => Promise<A | symbol>
): Effect.Effect<A, UserCancelled | WizardError> =>
  Effect.tryPromise({
    try: promise,
    catch: (cause) => new WizardError({ cause }),
  }).pipe(
    Effect.flatMap((v) =>
      isCancel(v)
        ? Effect.zipRight(
            Effect.sync(() => cancel("Cancelled.")),
            new UserCancelled({ stage })
          )
        : Effect.succeed(v as A)
    )
  );

export const promptText = (
  stage: string,
  opts: TextOptions
): Effect.Effect<string, UserCancelled | WizardError> =>
  wrapPrompt(stage, () => text(opts));

export const promptSelect = <V>(
  stage: string,
  opts: SelectOptions<V>
): Effect.Effect<V, UserCancelled | WizardError> =>
  wrapPrompt<V>(stage, () => select(opts));

export const promptConfirm = (
  stage: string,
  opts: ConfirmOptions
): Effect.Effect<boolean, UserCancelled | WizardError> =>
  wrapPrompt(stage, () => confirm(opts));

export const promptMultiselect = <V>(
  stage: string,
  opts: MultiselectOptions<V>
): Effect.Effect<ReadonlyArray<V>, UserCancelled | WizardError> =>
  wrapPrompt<ReadonlyArray<V>>(stage, () => multiselect(opts));
