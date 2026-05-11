import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
  isKebabCase,
  isReservedAppName,
  isValidRoutePath,
  nameFromRoutePath,
  readApps,
  routeIdFromPath,
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
  kind: "page" | "layout";
  extras: string[];
  name: string;
  routeId: string;
};

type FileMapping = readonly [out: string, template: string];

const APP_BASE_FILES: readonly FileMapping[] = [
  ["package.json", "templates/app/package.json.hbs"],
  ["tsconfig.json", "templates/app/tsconfig.json.hbs"],
  ["vite.config.ts", "templates/app/vite.config.ts.hbs"],
  ["components.json", "templates/app/components.json.hbs"],
  ["vitest.config.ts", "templates/app/vitest.config.ts.hbs"],
  ["vitest.setup.ts", "templates/app/vitest.setup.ts.hbs"],
  ["src/router.tsx", "templates/app/src/router.tsx.hbs"],
  ["src/routes/__root.tsx", "templates/app/src/routes/__root.tsx.hbs"],
  ["src/routes/index.tsx", "templates/app/src/routes/index.tsx.hbs"],
  ["src/routes/index.test.tsx", "templates/app/src/routes/index.test.tsx.hbs"],
  [
    "src/components/theme-provider.tsx",
    "templates/app/src/components/theme-provider.tsx.hbs",
  ],
];

const APP_CONVEX_FILES: readonly FileMapping[] = [
  ["convex/convex.config.ts", "templates/app/convex/convex.config.ts.hbs"],
  ["convex/schema.ts", "templates/app/convex/schema.ts.hbs"],
];

const APP_BETTER_AUTH_FILES: readonly FileMapping[] = [
  ["convex/auth.config.ts", "templates/app/convex/auth.config.ts.hbs"],
  ["convex/auth.ts", "templates/app/convex/auth.ts.hbs"],
  ["convex/http.ts", "templates/app/convex/http.ts.hbs"],
  ["src/lib/auth-server.ts", "templates/app/src/lib/auth-server.ts.hbs"],
  ["src/lib/auth-client.ts", "templates/app/src/lib/auth-client.ts.hbs"],
  ["src/lib/auth-providers.ts", "templates/app/src/lib/auth-providers.ts.hbs"],
  ["src/routes/api/auth.$.ts", "templates/app/src/routes/api/auth.$.ts.hbs"],
];

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  const repoRoot = process.cwd();

  plop.setGenerator("app", {
    description: "Create a new TanStack Start app under apps/",
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
        const next =
          data.withConvex || data.withBetterAuth
            ? `pnpm install\npnpm --filter ${data.name} convex   # bootstrap Convex types\npnpm --filter ${data.name} dev`
            : `pnpm install\npnpm --filter ${data.name} dev`;
        return [
          ``,
          `Created apps/${data.name}.`,
          ``,
          `Next steps:`,
          next.replace(/^/gm, "  "),
          ``,
          `The TanStack Router plugin will generate src/routeTree.gen.ts on first dev/build.`,
        ].join("\n");
      });

      return actions;
    },
  });

  plop.setGenerator("page", {
    description: "Add a new file route to an existing app",
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
          "Route path under src/routes/ (e.g. dashboard, posts/$id, _authed/settings, (group)/about)",
        validate: (value: string) => {
          if (!isValidRoutePath(value)) {
            return "Path must use [a-zA-Z0-9_-/()$@.], no leading/trailing slash, no '..'.";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "kind",
        message: "File kind",
        choices: [
          { name: "page (renders a leaf route)", value: "page" },
          { name: "layout (wraps children with <Outlet />)", value: "layout" },
        ],
        default: "page",
      },
      {
        type: "checkbox",
        name: "extras",
        message: "Add extras",
        choices: [
          {
            name: "src/lib/server/<name>.ts (createServerFn)",
            value: "server",
          },
          {
            name: "src/lib/validations/<name>.ts (zod schema)",
            value: "validation",
          },
        ],
      },
    ],
    actions: (raw) => {
      const data = raw as PageAnswers;
      data.name = nameFromRoutePath(data.routePath);
      data.routeId = routeIdFromPath(data.routePath);

      const routesDir = `apps/${data.app}/src/routes`;
      const lib = `apps/${data.app}/src/lib`;

      const routeTemplate =
        data.kind === "layout"
          ? "templates/page/layout.tsx.hbs"
          : "templates/page/page.tsx.hbs";

      const actions: PlopTypes.ActionType[] = [
        {
          type: "add",
          path: `${routesDir}/${data.routePath}.tsx`,
          templateFile: routeTemplate,
        },
      ];

      const extras = new Set(data.extras);

      if (extras.has("server")) {
        actions.push({
          type: "add",
          path: `${lib}/server/{{name}}.ts`,
          templateFile: "templates/page/lib-server.ts.hbs",
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
