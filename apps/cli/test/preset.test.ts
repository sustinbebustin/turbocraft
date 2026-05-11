import { describe, expect, it } from "@effect/vitest";
import { extractPresetCode } from "../src/flow/wizard.ts";

describe("extractPresetCode", () => {
  it("returns a bare code unchanged", () => {
    expect(extractPresetCode("a2r6bw")).toBe("a2r6bw");
  });

  it("trims whitespace around a bare code", () => {
    expect(extractPresetCode("  a2r6bw  \n")).toBe("a2r6bw");
  });

  it("extracts from `--preset code`", () => {
    expect(extractPresetCode("--preset a2r6bw")).toBe("a2r6bw");
  });

  it("extracts from `--preset=code`", () => {
    expect(extractPresetCode("--preset=a2r6bw")).toBe("a2r6bw");
  });

  it("extracts from a full pnpm dlx command", () => {
    expect(
      extractPresetCode(
        "pnpm dlx shadcn@latest init --preset a2r6bw --base base --template next"
      )
    ).toBe("a2r6bw");
  });

  it("extracts from a full npx command", () => {
    expect(
      extractPresetCode(
        "npx shadcn@latest init --preset buFznsW --base base --template next"
      )
    ).toBe("buFznsW");
  });

  it("extracts from a full bunx command", () => {
    expect(
      extractPresetCode(
        "bunx --bun shadcn@latest init --preset buFznsW --base base --template start"
      )
    ).toBe("buFznsW");
  });

  it("returns trimmed input when no --preset token is present", () => {
    // The caller's validator decides whether the result is a valid code; the
    // parser just normalises away the shadcn-snippet noise.
    expect(extractPresetCode("not a real preset")).toBe("not a real preset");
  });
});
