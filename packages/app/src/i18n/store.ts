import { useSyncExternalStore } from "react";
import { LANGUAGES, type Language } from "./define";

/** `system` follows the device; anything else is the user's pick. */
export type LanguagePreference = "system" | Language;

const STORAGE_KEY = "gleam:language";

const listeners = new Set<() => void>();

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language.code === value);
}

/** Maps a BCP 47 tag from the browser or OS to the closest language we ship, or English. */
export function matchLanguage(tag: string | undefined): Language {
  if (!tag) return "en";
  const lower = tag.toLowerCase();
  const base = lower.split(/[-_]/)[0];
  if (base === "zh") {
    // Traditional script or the regions that write it; a bare `zh` is Simplified.
    return /hant|[-_](tw|hk|mo)\b/.test(lower) ? "zh-TW" : "zh-CN";
  }
  // European Portuguese readers get Brazilian rather than English.
  if (base === "pt") return "pt-BR";
  // `in` is the legacy code Android still reports for Indonesian.
  if (base === "in") return "id";
  return LANGUAGES.find((language) => language.code === base)?.code ?? "en";
}

function systemLanguage(): Language {
  const tags = typeof navigator === "undefined" ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const tag of tags) {
    const match = matchLanguage(tag);
    if (match !== "en" || tag.toLowerCase().startsWith("en")) return match;
  }
  return "en";
}

function readPreference(): LanguagePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

let preference: LanguagePreference = readPreference();

export function resolveLanguage(pref: LanguagePreference): Language {
  return pref === "system" ? systemLanguage() : pref;
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function getLanguage(): Language {
  return resolveLanguage(preference);
}

/**
 * The choice lives in `localStorage` so the popup, side panel and approval
 * windows of the extension (one origin) agree; the phone keeps its own.
 */
export function setLanguagePreference(next: LanguagePreference): void {
  preference = next;
  try {
    if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not persisting only means the next open follows the device language.
  }
  notify();
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  preference = readPreference();
  notify();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
    window.addEventListener("languagechange", notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("languagechange", notify);
  };
}

export function useLanguagePreference(): LanguagePreference {
  return useSyncExternalStore(subscribe, getLanguagePreference, () => "system");
}

/** The language in use now; components re-render when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, () => "en");
}
