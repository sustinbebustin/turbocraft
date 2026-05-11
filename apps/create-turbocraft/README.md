# create-turbocraft

`npm create` shim for [`turbocraft`](https://www.npmjs.com/package/turbocraft). Forwards to `turbocraft create` so you can scaffold a project without a global install.

```bash
npm create turbocraft@latest my-app
pnpm create turbocraft my-app
bunx create-turbocraft my-app
```

All flags are passed straight through:

```bash
npm create turbocraft@latest my-app -- \
  --framework nextjs --layout monorepo \
  --features convex,better-auth
```

See the [main turbocraft README](https://github.com/sustinbebustin/turbocraft#readme) for variants, features, and the full CLI reference.

## License

MIT
