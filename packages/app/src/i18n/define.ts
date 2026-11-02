export const LANGUAGES = [
  { code: "en", name: "English", htmlLang: "en" },
  { code: "zh-CN", name: "简体中文", htmlLang: "zh-Hans" },
  { code: "zh-TW", name: "繁體中文", htmlLang: "zh-Hant" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

type Translated<T extends Record<string, string>> = Record<keyof T, string>;

/** English is the source: the other languages must carry exactly the same keys, or tsc fails. */
export interface MessageSet<T extends Record<string, string>> {
  en: T;
  "zh-CN": Translated<T>;
  "zh-TW": Translated<T>;
}

/**
 * Declares one namespace of UI text. Values may hold `{name}` placeholders,
 * filled by `t(key, { name })`; every language must use the same ones
 * (`catalog.i18n.test.ts`).
 */
export function defineMessages<const T extends Record<string, string>>(messages: MessageSet<T>): MessageSet<T> {
  return messages;
}
