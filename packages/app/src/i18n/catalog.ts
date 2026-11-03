import type { Language } from "./define";
import { NAMESPACES } from "./messages";

type Namespaces = typeof NAMESPACES;

export type MessageKey = {
  [N in keyof Namespaces]: `${N}.${keyof Namespaces[N]["en"] & string}`;
}[keyof Namespaces];

export type Catalog = Record<MessageKey, string>;

function flatten(language: Language): Catalog {
  const out: Record<string, string> = {};
  for (const [namespace, set] of Object.entries(NAMESPACES)) {
    for (const [name, text] of Object.entries(set[language] as Record<string, string>)) {
      out[`${namespace}.${name}`] = text;
    }
  }
  return out as Catalog;
}

export const CATALOGS: Record<Language, Catalog> = {
  en: flatten("en"),
  "zh-CN": flatten("zh-CN"),
  "zh-TW": flatten("zh-TW"),
};
