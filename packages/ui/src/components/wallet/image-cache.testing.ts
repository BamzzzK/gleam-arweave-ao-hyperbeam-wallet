import { vi } from "vitest";

/** A Cache Storage stand-in that keeps entries in insertion order, as the real one does. */
export function fakeCaches() {
  const entries = new Map<string, { body: string; type: string }>();
  const cache = {
    match: vi.fn(async (key: string) => {
      const entry = entries.get(key);
      return entry === undefined ? undefined : new Response(entry.body, { headers: { "content-type": entry.type } });
    }),
    put: vi.fn(async (key: string, response: Response) => {
      entries.set(key, { body: await response.text(), type: response.headers.get("content-type") ?? "" });
    }),
    keys: vi.fn(async () => [...entries.keys()].map((key) => ({ url: key }))),
    delete: vi.fn(async (key: string | { url: string }) => entries.delete(typeof key === "string" ? key : key.url)),
  };
  return { entries, storage: { open: vi.fn(async () => cache) } };
}
