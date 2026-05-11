import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
  isKebabCase,
  isReservedAppName,
  isValidRoutePath,
  nameFromRoutePath,
  readApps,
} from "./helpers.ts";

type AppAnswers = {
  name: string;
  description: string;
  withConvex: boolean;
  withBetterAuth: boolean;
};

type PageAnswers = {
  app: string;
  routePath: string;
  componentType: "server" | "client";
  extras: string[];
  name: string;
};

type FileMapping = readonly [out: string, template: string];

const APP_BASE_FILES: readonly FileMapping[] = [
  ["package.json", "templates/app/package.json.hbs"],
  ["tsconfig.json", "templates/app/tsconfig.json.hbs"],
  ["next.config.ts", "templates/app/next.config.ts.hbs"],
  ["next-env.d.ts", "templates/app/next-env.d.ts.hbs"],
  ["postcss.config.mjs", "templates/app/postcss.config.mjs.hbs"],
  ["components.json", "templates/app/components.json.hbs"],
  ["vitest.config.ts", "templates/app/vitest.config.ts.hbs"],
  ["vitest.setup.ts", "templates/app/vitest.setup.ts.hbs"],
  ["app/layout.tsx", "templates/app/app/layout.tsx.hbs"],
  ["app/page.tsx", "templates/app/app/page.tsx.hbs"],
  ["app/page.test.tsx", "templates/app/app/page.test.tsx.hbs"],
  [
    "components/theme-provider.tsx",
    "templates/app/components/theme-provider.tsx.hbs",
  ],
];

const APP_CONVEX_FILES: readonly FileMapping[] = [
  ["convex/convex.config.ts", "templates/app/convex/convex.config.ts.hbs"],
  ["convex/schema.ts", "templates/app/convex/schema.ts.hbs"],
  [
    "components/convex-client-provider.tsx",
    "templates/app/components/convex-client-provider.tsx.hbs",
  ],
];

const APP_BETTER_AUTH_FILES: readonly FileMapping[] = [
  ["convex/auth.config.ts", "templates/app/convex/auth.config.ts.hbs"],
  ["convex/auth.ts", "templates/app/convex/auth.ts.hbs"],
  ["convex/http.ts", "templates/app/convex/http.ts.hbs"],
  ["lib/auth-server.ts", "templates/app/lib/auth-server.ts.hbs"],
  ["lib/auth-client.ts", "templates/app/lib/auth-client.ts.hbs"],
  ["lib/auth-providers.ts", "templates/app/lib/auth-providers.ts.hbs"],
  ["app/api/auth/[...all]/route.ts", "templates/app/app/api/auth/route.ts.hbs"],
];

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  const repoRoot = process.cwd();

  plop.setGenerator("app", {
    description: "Create a new Next.js app under apps/",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "App name (kebab-case, e.g. dashboard, marketing)",
        validate: (value: string) => {
          if (!value) return "Required.";
          if (!isKebabCase(value)) {
            return "Use kebab-case: lowercase letters, digits, hyphens.";
          }
          if (isReservedAppName(value)) {
            return `'${value}' is reserved.`;
          }
          if (existsSync(join(repoRoot, "apps", value))) {
            return `apps/${value} already exists.`;
          }
          return true;
        },
      },
      {
        type: "input",
        name: "description",
        message: "Description (optional, used in package.json)",
        default: "",
      },
      {
        type: "confirm",
        name: "withConvex",
        message: "Wire in Convex backend?",
        default: false,
      },
      {
        type: "confirm",
        name: "withBetterAuth",
        message: "Wire in Better Auth (requires Convex)?",
        default: false,
        when: (answers: Partial<AppAnswers>) => Boolean(answers.withConvex),
      },
    ],
    actions: (raw) => {
      const data = raw as AppAnswers;
      const base = `apps/${data.name}`;
      const actions: PlopTypes.ActionType[] = APP_BASE_FILES.map(
        ([out, template]) => ({
          type: "add",
          path: `${base}/${out}`,
          templateFile: template,
        })
      );

      if (data.withConvex) {
        for (const [out, template] of APP_CONVEX_FILES) {
          actions.push({
            type: "add",
            path: `${base}/${out}`,
            templateFile: template,
          });
        }
      }

      if (data.withBetterAuth) {
        for (const [out, template] of APP_BETTER_AUTH_FILES) {
          actions.push({
            type: "add",
            path: `${base}/${out}`,
            templateFile: template,
          });
        }
      }

      actions.push(() => {
        const next = data.withBetterAuth
          ? `pnpm install\npnpm --filter ${data.name} convex   # bootstrap Convex types\npnpm --filter ${data.name} dev`
          : data.withConvex
            ? `pnpm install\npnpm --filter ${data.name} convex   # bootstrap Convex types\npnpm --filter ${data.name} dev`
            : `pnpm install\npnpm --filter ${data.name} dev`;
        return [
          ``,
          `Created apps/${data.name}.`,
          ``,
          `Next steps:`,
          next.replace(/^/gm, "  "),
          ``,
          `Don't forget to add "${data.name}" to apps/<other>/next.config.ts transpilePackages if it imports from @workspace/* packages.`,
        ].join("\n");
      });

      return actions;
    },
  });

  plop.setGenerator("page", {
    description: "Add a new route to an existing app",
    prompts: [
      {
        type: "list",
        name: "app",
        message: "Which app?",
        choices: () => {
          const apps = readApps(repoRoot);
          if (apps.length === 0) {
            throw new Error(
              "No apps found under apps/. Run `pnpm gen` and pick `app` first."
            );
          }
          return apps;
        },
      },
      {
        type: "input",
        name: "routePath",
        message:
          "Route path under app/ (e.g. dashboard, (app)/settings, blog/[slug])",
        validate: (value: string) => {
          if (!isValidRoutePath(value)) {
            return "Path must use [a-zA-Z0-9_-/()[]@.], no leading/trailing slash, no '..'.";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "componentType",
        message: "Component type",
        choices: ["server", "client"],
        default: "server",
      },
      {
        type: "checkbox",
        name: "extras",
        message: "Add extras",
        choices: [
          { name: "layout.tsx", value: "layout" },
          { name: "loading.tsx", value: "loading" },
          { name: 'error.tsx (forces "use client")', value: "error" },
          {
            name: 'lib/server/<name>.ts (import "server-only")',
            value: "server",
          },
          { name: 'lib/actions/<name>.ts ("use server")', value: "action" },
          {
            name: "lib/validations/<name>.ts (zod schema)",
            value: "validation",
          },
        ],
      },
    ],
    actions: (raw) => {
      const data = raw as PageAnswers & { isClient: boolean };
      data.name = nameFromRoutePath(data.routePath);
      data.isClient = data.componentType === "client";
      const segment = `apps/${data.app}/app/${data.routePath}`;
      const lib = `apps/${data.app}/lib`;
      const actions: PlopTypes.ActionType[] = [
        {
          type: "add",
          path: `${segment}/page.tsx`,
          templateFile: "templates/page/page.tsx.hbs",
        },
      ];

      const extras = new Set(data.extras);

      if (extras.has("layout")) {
        actions.push({
          type: "add",
          path: `${segment}/layout.tsx`,
          templateFile: "templates/page/layout.tsx.hbs",
        });
      }
      if (extras.has("loading")) {
        actions.push({
          type: "add",
          path: `${segment}/loading.tsx`,
          templateFile: "templates/page/loading.tsx.hbs",
        });
      }
      if (extras.has("error")) {
        actions.push({
          type: "add",
          path: `${segment}/error.tsx`,
          templateFile: "templates/page/error.tsx.hbs",
        });
      }
      if (extras.has("server")) {
        actions.push({
          type: "add",
          path: `${lib}/server/{{name}}.ts`,
          templateFile: "templates/page/lib-server.ts.hbs",
        });
      }
      if (extras.has("action")) {
        actions.push({
          type: "add",
          path: `${lib}/actions/{{name}}.ts`,
          templateFile: "templates/page/lib-action.ts.hbs",
        });
      }
      if (extras.has("validation")) {
        actions.push({
          type: "add",
          path: `${lib}/validations/{{name}}.ts`,
          templateFile: "templates/page/lib-validation.ts.hbs",
        });
      }

      return actions;
    },
  });
}
