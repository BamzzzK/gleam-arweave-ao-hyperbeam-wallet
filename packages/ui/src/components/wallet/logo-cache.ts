import { useEffect, useState } from "react";

/**
 * Token logos kept on the device by Arweave tx id. The bytes behind a tx
 * id can never change, so an entry never expires; a token that changes
 * its logo points at a new tx id. Gateways send logos with no caching
 * headers, so without this every popup open refetches each one through
 * the gateway's sandbox redirect. Keyed by tx id rather than URL so a
 * gateway switch keeps the cache.
 */
const CACHE_NAME = "token-logos";
const MAX_ENTRIES = 200;
const TX_ID_PATH = /^\/([A-Za-z0-9_-]{43})$/;

/** Object URLs live for the page's lifetime, shared by every row that shows the logo. */
const resolved = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function txIdOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return TX_ID_PATH.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function cacheAvailable(): boolean {
  return typeof caches !== "undefined" && typeof URL.createObjectURL === "function";
}

/** Cache API keys must be http(s) requests; this one never reaches the network. */
function cacheKey(txId: string): string {
  return `https://token-logo.invalid/${txId}`;
}

async function trim(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)));
}

/** An object URL for the logo, or null when it can't be fetched (the caller falls back to the plain URL). */
async function load(txId: string, url: string): Promise<string | null> {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(cacheKey(txId));
  if (hit) return URL.createObjectURL(await hit.blob());

  const response = await fetch(url, { referrerPolicy: "no-referrer", credentials: "omit" });
  if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const blob = await response.blob();
  await cache.put(cacheKey(txId), new Response(blob, { headers: { "content-type": blob.type } }));
  void trim(cache).catch(() => undefined);
  return URL.createObjectURL(blob);
}

function cachedLogo(txId: string, url: string): Promise<string | null> {
  let promise = pending.get(txId);
  if (!promise) {
    promise = load(txId, url)
      .catch(() => null)
      .then((objectUrl) => {
        if (objectUrl) resolved.set(txId, objectUrl);
        else pending.delete(txId);
        return objectUrl;
      });
    pending.set(txId, promise);
  }
  return promise;
}

/**
 * The `src` to draw `url` with: a cached object URL for an Arweave tx-id
 * logo, the URL itself for anything else (bundled data URIs) or when the
 * cache can't serve it, and `undefined` while the cache is being read.
 */
export function useCachedLogo(url: string | null | undefined): string | null | undefined {
  const txId = url && cacheAvailable() ? txIdOf(url) : null;
  const [loaded, setLoaded] = useState<{ txId: string; src: string } | null>(null);

  useEffect(() => {
    if (!txId || !url || resolved.has(txId)) return;
    let live = true;
    void cachedLogo(txId, url).then((objectUrl) => {
      if (live) setLoaded({ txId, src: objectUrl ?? url });
    });
    return () => {
      live = false;
    };
  }, [txId, url]);

  if (!url) return null;
  if (!txId) return url;
  return resolved.get(txId) ?? (loaded?.txId === txId ? loaded.src : undefined);
}

/** Test hook: forgets the in-memory object URLs. */
export function resetLogoCacheForTests(): void {
  resolved.clear();
  pending.clear();
}
