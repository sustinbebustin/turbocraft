export type Helper = (...args: ReadonlyArray<unknown>) => unknown;

const isString = (value: unknown): value is string => typeof value === "string";

const kebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[_\s]+/gu, "-")
    .toLowerCase();

const pascalCase = (value: string): string =>
  value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

const camelCase = (value: string): string => {
  const pascal = pascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

export const helpers: Record<string, Helper> = {
  eq: (a: unknown, b: unknown) => a === b,
  ne: (a: unknown, b: unknown) => a !== b,
  not: (a: unknown) => !a,
  and: (...args: ReadonlyArray<unknown>) => args.slice(0, -1).every(Boolean),
  or: (...args: ReadonlyArray<unknown>) => args.slice(0, -1).some(Boolean),
  ifAny: (...args: ReadonlyArray<unknown>) => args.slice(0, -1).some(Boolean),
  kebabCase: (value: unknown) => (isString(value) ? kebabCase(value) : ""),
  pascalCase: (value: unknown) => (isString(value) ? pascalCase(value) : ""),
  camelCase: (value: unknown) => (isString(value) ? camelCase(value) : ""),
  upperFirst: (value: unknown) =>
    isString(value) && value.length > 0
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : "",
};

export function registerHelpers(plop: {
  setHelper: (name: string, helper: Helper) => void;
}): void {
  for (const [name, helper] of Object.entries(helpers)) {
    plop.setHelper(name, helper);
  }
}
