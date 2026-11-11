import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readText, type Deps } from "./shared.ts";

/** The limits `security/scan/REPORT.md` sets for the part of an advisory above `<details>`. */
export const MAX_WORDS = 120;
export const MAX_GRADE = 8;
/** About one sentence: REPORT.md § Advisory title. */
export const MAX_TITLE_CHARS = 100;

export interface Readability {
  words: number;
  sentences: number;
  syllables: number;
  /** Flesch-Kincaid grade level; 0 for text with no words. */
  grade: number;
}

/** A vowel-group count with the usual English corrections. Close enough to rank prose, not to hyphenate it. */
export function countSyllables(word: string): number {
  const parts = word.toLowerCase().split("-").filter(Boolean);
  if (parts.length > 1) return parts.reduce((sum, part) => sum + countSyllables(part), 0);
  const w = (parts[0] ?? "").replace(/[^a-z]/g, "");
  if (w.length === 0) return 1;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, (m) => m[0]!).replace(/^y/, "");
  return Math.max(1, trimmed.match(/[aeiouy]{1,2}/g)?.length ?? 0);
}

/** Markdown reduced to prose blocks: code, tags and markup removed; each heading, list item or paragraph is one block. */
function proseBlocks(markdown: string): string[] {
  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, "\n")
    .replace(/<\/?[A-Za-z][^<>\n]*>/g, " ")
    .replace(/`[^`\n]*`/g, "code")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "link");
  const blocks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) blocks.push(current.join(" "));
    current = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || /^attestation id:/i.test(line) || /^\|/.test(line)) {
      flush();
      continue;
    }
    const startsBlock = /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>)/.test(line);
    if (startsBlock) flush();
    current.push(line.replace(/^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "").replace(/[*_~]/g, ""));
    if (startsBlock && /^#{1,6}\s/.test(line)) flush();
  }
  flush();
  return blocks;
}

export function readability(markdown: string): Readability {
  let words = 0;
  let sentences = 0;
  let syllables = 0;
  for (const block of proseBlocks(markdown)) {
    const pieces = block.split(/[.!?]+(?:\s+|$)/);
    for (const piece of pieces) {
      const tokens = piece.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? [];
      if (tokens.length === 0) continue;
      sentences++;
      words += tokens.length;
      for (const token of tokens) syllables += countSyllables(token);
    }
  }
  if (words === 0) return { words: 0, sentences: 0, syllables: 0, grade: 0 };
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return { words, sentences, syllables, grade: Math.round(grade * 10) / 10 };
}

/** The part a maintainer skims: everything before the first `<details>`. */
export function aboveTheFold(markdown: string): string {
  const at = markdown.search(/<details[\s>]/i);
  return at === -1 ? markdown : markdown.slice(0, at);
}

/** An advisory draft's `Title: …` first line, and the body under it. */
export function splitTitle(markdown: string): { title: string | undefined; body: string } {
  const m = /^Title:[ \t]*(.*)(?:\r?\n|$)/.exec(markdown);
  return m ? { title: m[1]!.trim(), body: markdown.slice(m[0].length) } : { title: undefined, body: markdown };
}

/**
 * The mechanical half of REPORT.md § Advisory title. Whether a title names the risk
 * is judgment; these catch the parser-facing habits: check ids, code names, riders.
 */
export function titleProblems(title: string | undefined): string[] {
  if (title === undefined || title === "") return ["no title"];
  const problems: string[] = [];
  if (title.length > MAX_TITLE_CHARS) problems.push(`title is ${title.length} characters (limit ${MAX_TITLE_CHARS})`);
  if (/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*:/.test(title)) problems.push("title starts with a check id");
  if (/`|\b[a-z]{2,}[A-Z][a-z]/.test(title)) problems.push("title has a code name");
  if (/[()]/.test(title)) problems.push("title has a parenthetical");
  return problems;
}

/** One `! <file>: …` line for a draft whose title or summary breaks REPORT.md, else undefined. */
export function draftWarning(file: string, markdown: string): string | undefined {
  const { title, body } = splitTitle(markdown);
  const { words, grade } = readability(aboveTheFold(body));
  const titled = titleProblems(title);
  const problems = [...titled];
  if (words > MAX_WORDS) problems.push(`${words} words above <details> (limit ${MAX_WORDS})`);
  if (grade > MAX_GRADE) problems.push(`reading grade ${grade} (limit ${MAX_GRADE})`);
  if (problems.length === 0) return undefined;
  const fixes = [
    ...(title === undefined || title === "" ? ["start the draft with a Title: line"] : []),
    ...(titled.length > 0 ? ["name the risk in the user's words"] : []),
    ...(words > MAX_WORDS ? ["move impact, steps, traces and code into <details>"] : []),
    ...(grade > MAX_GRADE ? ["use short sentences and common words"] : []),
  ];
  return `! ${file}: ${problems.join(", ")}; ${fixes.join(", and ")} (security/scan/REPORT.md).`;
}

/** The advisory drafts in a round folder, sorted, as paths relative to the checkout. */
export async function advisoryDrafts(deps: Deps, dir: string): Promise<string[]> {
  return listDrafts(deps, dir, /^advisory-.*\.md$/);
}

/** The PR body drafts in a round folder, sorted, as paths relative to the checkout. */
export async function prDrafts(deps: Deps, dir: string): Promise<string[]> {
  return listDrafts(deps, dir, /^pr-.*\.md$/);
}

async function listDrafts(deps: Deps, dir: string, pattern: RegExp): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(join(deps.root, dir));
  } catch {
    return [];
  }
  return names.filter((name) => pattern.test(name)).sort().map((name) => `${dir}/${name}`);
}

/** A warning line per advisory draft in a round folder that breaks REPORT.md's title rules or limits. Never fails the scan. */
export async function draftWarnings(deps: Deps, dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const file of await advisoryDrafts(deps, dir)) {
    const text = await readText(deps, file);
    const warning = text === undefined ? undefined : draftWarning(file, text);
    if (warning !== undefined) out.push(warning);
  }
  return out;
}
