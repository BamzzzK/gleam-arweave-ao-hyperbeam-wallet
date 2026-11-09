// @vitest-environment node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeDeps } from "./harness.ts";
import { aboveTheFold, countSyllables, draftWarning, draftWarnings, readability, splitTitle, titleProblems } from "./readability.ts";

const T = "Title: A connected site can steal the user's tokens\n";
const LONG_WORDS =
  "Consequently, the cryptographic authorization infrastructure inadvertently facilitates unauthenticated transactional manipulation by adversarial intermediaries operating asynchronously.";

describe("readability", () => {
  it("counts syllables with the vowel-group heuristic", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("wallet")).toBe(2);
    expect(countSyllables("table")).toBe(2);
    expect(countSyllables("signed")).toBe(1);
    expect(countSyllables("signature")).toBe(3);
    expect(countSyllables("approval")).toBe(3);
    expect(countSyllables("read-only")).toBe(3);
    expect(countSyllables("42")).toBe(1);
  });

  it("computes words, sentences and the Flesch-Kincaid grade", () => {
    expect(readability("The cat sat on the mat. The dog ran.")).toEqual({ words: 9, sentences: 2, syllables: 9, grade: -2.0 });
    expect(readability("")).toEqual({ words: 0, sentences: 0, syllables: 0, grade: 0 });
    expect(readability(LONG_WORDS).grade).toBeGreaterThan(20);
  });

  it("treats headings and list items as sentences and ignores code, tags and the id line", () => {
    const md = "## Steps\n\n1. Open the page\n2. Click Sign\n\n```ts\nconst veryLongIdentifierName = 1;\n```\n\nAttestation id: {{ATTESTATION_ID}}\n<b>Done</b>.";
    expect(readability(md)).toMatchObject({ words: 7, sentences: 4 });
    expect(readability("Joined across\nwrapped lines.")).toMatchObject({ words: 4, sentences: 1 });
    expect(readability("If a < b and c > d, it holds.")).toMatchObject({ words: 8, sentences: 1 });
  });

  it("measures only the part above <details>", () => {
    expect(aboveTheFold("Short.\n<details><summary>x</summary>long</details>")).toBe("Short.\n");
    expect(aboveTheFold("No fold.")).toBe("No fold.");
  });
});

describe("draft warnings", () => {
  it("names what to shorten, in one line", () => {
    expect(draftWarning("a.md", `${T}The page signs it. The user loses funds.`)).toBeUndefined();
    const wordy = Array.from({ length: 60 }, () => "The page signs a tag the user never saw.").join(" ");
    expect(draftWarning("a.md", T + wordy)).toBe(
      "! a.md: 540 words above <details> (limit 200); move traces, code and duplicate notes into <details> (security/scan/REPORT.md).",
    );
    expect(draftWarning("b.md", T + LONG_WORDS)).toMatch(/^! b\.md: reading grade \d+(\.\d)? \(limit 10\); use shorter sentences and plainer words/);
    expect(draftWarning("c.md", `${T}${wordy}\n<details>${LONG_WORDS.repeat(50)}</details>`)).not.toContain("grade");
  });

  it("checks only .gleam-scan/advisory-*.md, and prints nothing without drafts", async () => {
    const deps = makeDeps();
    expect(await draftWarnings(deps)).toEqual([]);
    mkdirSync(join(deps.root, ".gleam-scan"));
    writeFileSync(join(deps.root, ".gleam-scan/advisory-1.md"), `${T}Short and plain. It reads well.`);
    writeFileSync(join(deps.root, ".gleam-scan/advisory-2.md"), T + LONG_WORDS);
    writeFileSync(join(deps.root, ".gleam-scan/pr-1.md"), LONG_WORDS);
    const out = await draftWarnings(deps);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^! \.gleam-scan\/advisory-2\.md: reading grade/);
  });

  it("reads the title from the first line only", () => {
    expect(splitTitle("Title:  A site can read balances \nBody.")).toEqual({ title: "A site can read balances", body: "Body." });
    expect(splitTitle("Body.\nTitle: late")).toEqual({ title: undefined, body: "Body.\nTitle: late" });
  });

  it("flags parser-style titles", () => {
    expect(titleProblems("Any site can learn which tokens a wallet watches")).toEqual([]);
    expect(titleProblems(undefined)).toEqual(["no title"]);
    expect(titleProblems("C-1: dispatch hides a transfer")).toEqual(["title starts with a check id"]);
    expect(titleProblems("D-B-1: gate omits files")).toEqual(["title starts with a check id"]);
    expect(titleProblems("AO: sends can fail")).toEqual([]);
    expect(titleProblems("isTokenAdded leaks the token list")).toEqual(["title has a code name"]);
    expect(titleProblems("The `Action` tag is hidden")).toEqual(["title has a code name"]);
    expect(titleProblems("The iOS and GitHub builds differ")).toEqual([]);
    expect(titleProblems("Sites can enumerate tokens (weak)")).toEqual(["title has a parenthetical"]);
    expect(titleProblems("x".repeat(101))).toEqual(["title is 101 characters (limit 100)"]);
  });

  it("says how to fix a missing or parser-style title", () => {
    expect(draftWarning("a.md", "The page signs it.")).toBe(
      "! a.md: no title; start the draft with a Title: line, and name the risk in the user's words (security/scan/REPORT.md).",
    );
    expect(draftWarning("a.md", "Title: T-A1: isTokenAdded oracle\nThe page signs it.")).toBe(
      "! a.md: title starts with a check id, title has a code name; name the risk in the user's words (security/scan/REPORT.md).",
    );
  });

  it("passes every risk title in REPORT.md", () => {
    const doc = readFileSync(join(import.meta.dirname, "../../security/scan/REPORT.md"), "utf8");
    const section = /## Advisory title([\s\S]*?)\n## /.exec(doc)?.[1] ?? "";
    const titles = [...section.matchAll(/^\| .+ \| (.+) \|$/gm)].map((m) => m[1]!).filter((t) => t !== "Risk title" && !t.startsWith("---"));
    expect(titles.length).toBeGreaterThanOrEqual(4);
    for (const title of titles) expect(titleProblems(title), title).toEqual([]);
  });

  it("passes the example advisory in REPORT.md", () => {
    const doc = readFileSync(join(import.meta.dirname, "../../security/scan/REPORT.md"), "utf8");
    const example = /## Example advisory[\s\S]*?```markdown\n([\s\S]*?)\n```/.exec(doc)?.[1];
    expect(example).toContain("<details>");
    expect(draftWarning("example", example!)).toBeUndefined();
    const { words, grade } = readability(aboveTheFold(example!));
    expect(words).toBeLessThanOrEqual(200);
    expect(grade).toBeLessThanOrEqual(9.5);
  });
});
