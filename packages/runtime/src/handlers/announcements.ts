import type { Announcement, StoragePort } from "@gleam/core";
import { SITE_URL } from "@gleam/core/src/models/site-origin.ts";

export const ANNOUNCEMENTS_URL = new URL("announcements.json", SITE_URL).toString();
/** Ids of announcements the user has dismissed, as `string[]`. */
export const ANNOUNCEMENTS_DISMISSED_KEY = "local:announcements:dismissed";

/**
 * Hosts an announcement may link to. The file is served from the site's
 * deploy, so a bad entry must not be able to send users somewhere
 * arbitrary: anything else is dropped, entry and all.
 */
export const ANNOUNCEMENT_LINK_HOSTS: readonly string[] = [new URL(SITE_URL).hostname, "x.com"];

function allowedUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.username === "" && url.password === "" && ANNOUNCEMENT_LINK_HOSTS.includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Where the wallet runs: the shell an entry's `platforms` can name. */
export type AnnouncementShell = "extension" | "android" | "ios";

/** The install reading the file. `web` is the mobile app's browser preview, which no `platforms` list names. */
export interface AnnouncementTarget {
  shell: AnnouncementShell | "web";
  version: string;
}

const SHELLS: readonly string[] = ["extension", "android", "ios"] satisfies AnnouncementShell[];

function parseVersion(raw: unknown): [number, number, number] | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(raw);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isBelow(version: [number, number, number], bound: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (version[i]! !== bound[i]!) return version[i]! < bound[i]!;
  }
  return false;
}

/**
 * Whether an entry's optional `platforms` and `below` let it show on this
 * install, or null when either is malformed, which drops the entry. An
 * update notice names the platforms that don't update themselves and the
 * version that fixes things, so installs already on it never see it.
 */
function matchesTarget(platforms: unknown, below: unknown, target: AnnouncementTarget): boolean | null {
  if (platforms !== undefined) {
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    if (!platforms.every((shell) => typeof shell === "string" && SHELLS.includes(shell))) return null;
    if (!(platforms as string[]).includes(target.shell)) return false;
  }
  if (below !== undefined) {
    const bound = parseVersion(below);
    if (bound === null) return null;
    const current = parseVersion(target.version);
    // A version that can't be read can't be shown to be older.
    if (current === null || !isBelow(current, bound)) return false;
  }
  return true;
}

/**
 * Keeps the well-formed entries meant for `target`; a file that isn't an
 * array yields none.
 */
export function parseAnnouncements(raw: unknown, target: AnnouncementTarget): Announcement[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Announcement[] = [];
  for (const entry of raw as unknown[]) {
    if (entry === null || typeof entry !== "object") continue;
    const { id, level, title, text, url, platforms, below } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || seen.has(id)) continue;
    if (level !== "info" && level !== "critical") continue;
    if (typeof text !== "string" || text.trim() === "") continue;
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) continue;
    const safe = url === undefined ? undefined : allowedUrl(url);
    if (safe === null) continue;
    if (matchesTarget(platforms, below, target) !== true) continue;
    seen.add(id);
    out.push({ id, level, ...(title === undefined ? {} : { title }), text, ...(safe === undefined ? {} : { url: safe }) });
  }
  return out;
}

export interface AnnouncementsHandlerDeps {
  storage: StoragePort;
  target: AnnouncementTarget;
  url?: string;
  fetchImpl?: typeof fetch;
}

export class AnnouncementsHandler {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly deps: AnnouncementsHandlerDeps) {
    this.fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /**
   * A plain GET of a static file; any failure reads as "no announcements".
   * The site serves `Access-Control-Allow-Origin: *`, so this needs no host
   * permission: adding one would make Chrome disable the extension on
   * update until each user re-approves it.
   */
  async fetchAnnouncements(): Promise<Announcement[]> {
    try {
      const response = await this.fetchImpl(this.deps.url ?? ANNOUNCEMENTS_URL, {
        credentials: "omit",
        cache: "no-cache",
      });
      if (!response.ok) return [];
      return parseAnnouncements(await response.json(), this.deps.target);
    } catch {
      return [];
    }
  }

  async getDismissed(): Promise<string[]> {
    const stored = await this.deps.storage.get<unknown>(ANNOUNCEMENTS_DISMISSED_KEY);
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  }

  async dismiss(req: { id: string }): Promise<void> {
    const dismissed = await this.getDismissed();
    if (dismissed.includes(req.id)) return;
    await this.deps.storage.set(ANNOUNCEMENTS_DISMISSED_KEY, [...dismissed, req.id]);
  }
}
