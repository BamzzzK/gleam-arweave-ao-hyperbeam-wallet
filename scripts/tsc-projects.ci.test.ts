// @vitest-environment node
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const run = promisify(execFile);

/** The `pnpm tsc -p <project> --noEmit` projects a file runs, in order. */
function projectsIn(file: string): string[] {
  return [...readFileSync(join(ROOT, file), "utf8").matchAll(/pnpm tsc -p (\S+) --noEmit/g)].map((match) => match[1]!);
}

describe("tsc projects", () => {
  const hook = projectsIn("lefthook.yml");

  it("are the same in the pre-commit hook and CI", () => {
    expect(hook.length).toBeGreaterThanOrEqual(12);
    expect(projectsIn(".github/workflows/ci.yml")).toEqual(hook);
  });

  // A file in no project is never typechecked: a type error in it passes every check.
  it("cover every tracked TypeScript file", async () => {
    const tsc = join(ROOT, "node_modules/.bin/tsc");
    const listed = new Set(
      (
        await Promise.all(
          hook.map(async (project) => (await run(tsc, ["-p", project, "--listFilesOnly"], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })).stdout),
        )
      )
        .flatMap((out) => out.split("\n"))
        .filter((path) => path !== "" && !path.includes("/node_modules/"))
        .map((path) => relative(ROOT, path)),
    );
    const { stdout } = await run("git", ["ls-files", "*.ts", "*.tsx", "*.mts"], { cwd: ROOT });
    const unchecked = stdout.split("\n").filter((path) => path !== "" && !listed.has(path));
    expect(unchecked, "add each file to a tsconfig the hook and CI run").toEqual([]);
  }, 120_000);
});
