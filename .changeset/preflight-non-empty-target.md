---
"turbocraft": patch
---

Detect non-empty target directories up front instead of after the wizard.

`turbocraft create my-app` used to walk the user through the entire
interactive flow before failing with an opaque "FsError: An error has
occurred" when the target dir already existed. The check now runs in
three places so the failure surfaces immediately:

- before any prompts when `--name` is passed as a positional,
- inline in the wizard's name validator while the user is typing,
- as a final safety net in `scaffold` for direct callers.

The new failure message lists the conflicting entries and recommends
either picking a different name or `rm -rf <dir>`.

Breaking: the `--force` flag is removed. `turbocraft create` will not
write into a non-empty directory. Remove the directory explicitly to
re-scaffold.
