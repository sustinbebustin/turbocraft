import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting tailwind classes, keeping the last", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("always returns a string for any class input", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string(),
            fc.constant(false),
            fc.constant(null),
            fc.constant(undefined)
          )
        ),
        (inputs) => {
          expect(typeof cn(...inputs)).toBe("string");
        }
      )
    );
  });
});
