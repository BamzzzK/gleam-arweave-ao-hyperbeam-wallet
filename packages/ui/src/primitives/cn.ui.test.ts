import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cn, TYPE_SCALE_CLASSES } from "./cn";

const themeCss = readFileSync(resolve(__dirname, "../tokens/theme.css"), "utf8");
const themeSizes = [...new Set([...themeCss.matchAll(/--text-([a-z0-9]+(?:-[a-z0-9]+)*):/g)].map((m) => `text-${m[1]}`))];

describe("cn", () => {
  it("knows every font size theme.css defines", () => {
    expect([...TYPE_SCALE_CLASSES].sort()).toEqual(themeSizes.sort());
  });

  it.each(TYPE_SCALE_CLASSES)("keeps %s beside a text colour", (size) => {
    expect(cn(size, "text-foreground")).toBe(`${size} text-foreground`);
  });

  it("lets a later size replace an earlier one", () => {
    expect(cn("text-body", "text-display")).toBe("text-display");
  });
});
