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
  ])("%s → %s", (tag, expected) => {
    expect(matchLanguage(tag)).toBe(expected);
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(translate("zh-CN", "language.title")).toBe("语言");
  });
});
