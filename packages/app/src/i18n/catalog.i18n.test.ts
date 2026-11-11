import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGS } from "./catalog";
import { LANGUAGES } from "./define";
import { matchLanguage } from "./store";
import { translate } from "./index";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalogs", () => {
  const keys = Object.keys(CATALOGS.en) as (keyof typeof CATALOGS.en)[];

  it.each(LANGUAGES.map((l) => l.code))("%s has every key, non-empty, with the same placeholders as English", (code) => {
    expect(Object.keys(CATALOGS[code]).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(CATALOGS[code][key], key).not.toBe("");
      expect(placeholders(CATALOGS[code][key]), key).toEqual(placeholders(CATALOGS.en[key]));
    }
  });
});

const REPO = join(import.meta.dirname, "../../../..");

/** Every non-test source file that can call `t()`, the catalogs themselves left out. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ["node_modules", "messages", ".output", ".wxt", "dist"].includes(entry.name) ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Keys read through a built name rather than a literal. Each entry says
 * where, so a key whose caller goes away doesn't stay listed.
 */
const BUILT_KEYS: Record<string, string> = {
  "points.today": "RecentEarnings.tsx, t(`points.${day.day}`)",
  "points.yesterday": "RecentEarnings.tsx, t(`points.${day.day}`)",
};

describe("message keys", () => {
  it("are each read somewhere, by literal name or as a listed built name", () => {
    const source = ["packages/app/src", "packages/keystone/src", "apps/extension/src", "apps/extension/entrypoints", "apps/mobile/src"]
      .flatMap((dir) => sourceFiles(join(REPO, dir)))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const unread = Object.keys(CATALOGS.en).filter(
      (key) =>
        // `errorText` reads `errors.*` by the English message it matches.
        !key.startsWith("errors.") &&
        !Object.hasOwn(BUILT_KEYS, key) &&
        ![`"${key}"`, `'${key}'`, `\`${key}\``].some((quoted) => source.includes(quoted)),
    );
    expect(unread, "delete each from every language, or list it in BUILT_KEYS").toEqual([]);
  });

  it("lists only built keys that exist", () => {
    for (const key of Object.keys(BUILT_KEYS)) expect(Object.keys(CATALOGS.en)).toContain(key);
  });
});

describe("matchLanguage", () => {
  it.each([
    ["en-US", "en"],
    ["fr-FR", "en"],
    [undefined, "en"],
    ["zh", "zh-CN"],
    ["zh-CN", "zh-CN"],
    ["zh-Hans-CN", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh-Hant", "zh-TW"],
    ["zh-Hant-HK", "zh-TW"],
    ["ko-KR", "ko"],
    ["ja", "ja"],
    ["es-MX", "es"],
    ["es-419", "es"],
    ["pt-BR", "pt-BR"],
    ["pt-PT", "pt-BR"],
    ["tr-TR", "tr"],
    ["vi-VN", "vi"],
    ["ru-RU", "ru"],
    ["id-ID", "id"],
    ["in-ID", "id"],
  ])("%s → %s", (tag, expected) => {
    expect(matchLanguage(tag)).toBe(expected);
  });
});

describe("translate", () => {
  it("returns the language's text", () => {
    expect(translate("zh-CN", "language.title")).toBe("语言");
  });

  it("fills placeholders, including replacement patterns in a value", () => {
    expect(translate("en", "common.securityPhrase", { word: "$&" })).toBe("Your anti-phishing phrase: $&");
  });

  it("leaves a placeholder with no value in place", () => {
    expect(translate("en", "common.securityPhrase", {})).toBe("Your anti-phishing phrase: {word}");
  });
});
