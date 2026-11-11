import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS = join(import.meta.dirname, "../.github/workflows");

interface Job {
  name: string;
  /** Each step's source lines, joined. */
  steps: string[];
}

/**
 * The jobs of a workflow and the text of each step. Enough YAML for the
 * repo's own workflows: two-space indents, `jobs:` at the top level and
 * each step a `- ` item under `steps:`.
 */
function jobsOf(source: string): Job[] {
  const lines = source.split("\n");
  const jobs: Job[] = [];
  let inJobs = false;
  let job: Job | null = null;
  let stepIndent = -1;
  let step: string[] | null = null;
  const flush = () => {
    if (job && step) job.steps.push(step.join("\n"));
    step = null;
  };
  for (const line of lines) {
    if (/^\S/.test(line)) {
      flush();
      inJobs = line.startsWith("jobs:");
      job = null;
      continue;
    }
    if (!inJobs) continue;
    const jobMatch = /^ {2}([\w-]+):\s*$/.exec(line);
    if (jobMatch) {
      flush();
      job = { name: jobMatch[1]!, steps: [] };
      jobs.push(job);
      stepIndent = -1;
      continue;
    }
    if (!job) continue;
    const stepsMatch = /^(\s+)steps:\s*$/.exec(line);
    if (stepsMatch) {
      flush();
      stepIndent = stepsMatch[1]!.length + 2;
      continue;
    }
    if (stepIndent < 0) continue;
    const indent = line.length - line.trimStart().length;
    if (line.trim() === "") continue;
    if (indent === stepIndent && line.trimStart().startsWith("- ")) {
      flush();
      step = [line];
    } else if (indent > stepIndent && step) {
      step.push(line);
    } else if (indent < stepIndent) {
      flush();
      stepIndent = -1;
    }
  }
  flush();
  return jobs;
}

/** A step's `if:` expression, folded onto one line. */
function conditionOf(step: string): string {
  const match = /- if: (?:>-\n)?([\s\S]*?)\n\s+run:/.exec(step);
  return match ? match[1]!.replace(/\s+/g, " ").trim() : "";
}

function workflow(name: string): string {
  return readFileSync(join(WORKFLOWS, name), "utf8");
}

describe("dependabot-automerge.yml", () => {
  const steps = jobsOf(workflow("dependabot-automerge.yml")).flatMap((job) => job.steps);
  const ghSteps = steps.filter((step) => /\bgh pr (review|merge)\b/.test(step));

  it("approves and merges through gh steps the checks below can see", () => {
    expect(ghSteps.length).toBe(2);
  });

  it.each([
    "steps.metadata.outputs.update-type != 'version-update:semver-major'",
    "steps.metadata.outputs.package-ecosystem == 'npm_and_yarn'",
    "steps.metadata.outputs.dependency-type == 'direct:development'",
    "steps.metadata.outputs.dependency-group != 'build-toolchain'",
  ])("every gh step requires %s", (condition) => {
    for (const step of ghSteps) {
      const expression = conditionOf(step);
      expect(expression).not.toMatch(/\|\||\$\{\{/);
      expect(expression.split("&&").map((part) => part.trim())).toContain(condition);
    }
  });
});

describe("jobsOf", () => {
  it("reads every workflow in .github/workflows", () => {
    for (const file of readdirSync(WORKFLOWS).filter((name) => name.endsWith(".yml"))) {
      expect(jobsOf(workflow(file)).length, file).toBeGreaterThan(0);
    }
  });
});
