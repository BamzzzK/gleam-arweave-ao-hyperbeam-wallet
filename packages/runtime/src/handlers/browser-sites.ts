import type { StoragePort } from "@gleam/core";
import { userErrorMessage } from "@gleam/core/src/models/user-errors.ts";
import { updateStored } from "../storage-update";

/**
 * Background-side implementation of the dApp browser's saved and recent
 * site lists. Both hold bare origins (`https://host`), so a saved site opens
 * the site, not the page the user was on.
 *
 * Storage schema this handler owns:
 * - `local:browserSavedSites` — `string[]`, most recently saved first.
 * - `local:browserRecentSites` — `string[]`, most recently opened first,
 *   at most `MAX_RECENT_SITES`.
 *
 * Browsing data: wiped with the vault (`wallet-lifecycle.ts`'s reset).
 */
export const BROWSER_SAVED_SITES_KEY = "local:browserSavedSites";
export const BROWSER_RECENT_SITES_KEY = "local:browserRecentSites";
export const MAX_RECENT_SITES = 10;

export interface BrowserSites {
  saved: string[];
  recent: string[];
}

/** The origin of an http(s) URL, or throws. */
function webOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(userErrorMessage("enterWebAddress"));
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(userErrorMessage("enterWebAddress"));
  return parsed.origin;
}

function origins(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

export class BrowserSitesHandler {
  constructor(private readonly storage: StoragePort) {}

  private async load(key: string): Promise<string[]> {
    return origins(await this.storage.get<unknown>(key));
  }

  async listBrowserSites(): Promise<BrowserSites> {
    const [saved, recent] = await Promise.all([this.load(BROWSER_SAVED_SITES_KEY), this.load(BROWSER_RECENT_SITES_KEY)]);
    return { saved, recent };
  }

  async saveBrowserSite(req: { url: string }): Promise<void> {
    const origin = webOrigin(req.url);
    await updateStored(this.storage, BROWSER_SAVED_SITES_KEY, (raw) => [
      origin,
      ...origins(raw).filter((entry) => entry !== origin),
    ]);
  }

  async removeBrowserSite(req: { origin: string }): Promise<void> {
    await updateStored(this.storage, BROWSER_SAVED_SITES_KEY, (raw) => {
      const saved = origins(raw);
      const next = saved.filter((entry) => entry !== req.origin);
      return next.length !== saved.length ? next : undefined;
    });
  }

  async recordRecentSite(req: { url: string }): Promise<void> {
    const origin = webOrigin(req.url);
    await updateStored(this.storage, BROWSER_RECENT_SITES_KEY, (raw) =>
      [origin, ...origins(raw).filter((entry) => entry !== origin)].slice(0, MAX_RECENT_SITES),
    );
  }

  async clearRecentSites(): Promise<void> {
    await this.storage.remove(BROWSER_RECENT_SITES_KEY);
  }
}
