export const LANGUAGES = [
  { code: "en", name: "English", htmlLang: "en" },
  { code: "es", name: "Español", htmlLang: "es" },
  { code: "id", name: "Bahasa Indonesia", htmlLang: "id" },
  { code: "pt-BR", name: "Português (Brasil)", htmlLang: "pt-BR" },
  { code: "vi", name: "Tiếng Việt", htmlLang: "vi" },
  { code: "tr", name: "Türkçe", htmlLang: "tr" },
  { code: "ru", name: "Русский", htmlLang: "ru" },
  { code: "ja", name: "日本語", htmlLang: "ja" },
  { code: "ko", name: "한국어", htmlLang: "ko" },
  { code: "zh-CN", name: "简体中文", htmlLang: "zh-Hans" },
  { code: "zh-TW", name: "繁體中文", htmlLang: "zh-Hant" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

type Translated<T extends Record<string, string>> = Record<keyof T, string>;

/** English is the source: the other languages must carry exactly the same keys, or tsc fails. */
export type MessageSet<T extends Record<string, string>> = { en: T } & Record<Exclude<Language, "en">, Translated<T>>;

/**
 * Declares one namespace of UI text. Values may hold `{name}` placeholders,
 * filled by `t(key, { name })`; every language must use the same ones
 * (`catalog.i18n.test.ts`).
 */
export function defineMessages<const T extends Record<string, string>>(messages: MessageSet<T>): MessageSet<T> {
  return messages;
}
