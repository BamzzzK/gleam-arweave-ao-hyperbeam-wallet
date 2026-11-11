import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("storage keys", () => {
  it("declares each key string in one file", () => {
    const declaredIn = new Map<string, string[]>();
    for (const file of sourceFiles(SRC)) {
      for (const [, key] of readFileSync(file, "utf8").matchAll(/^(?:export )?const \w+ = "((?:local|session):[^"]*)";/gm)) {
        declaredIn.set(key!, [...(declaredIn.get(key!) ?? []), relative(SRC, file)]);
      }
    }
    const repeated = [...declaredIn].filter(([, files]) => files.length > 1);
    expect(repeated, "move a key used in more than one file to storage-keys.ts").toEqual([]);
    expect(declaredIn.size).toBeGreaterThan(30);
  });
});
