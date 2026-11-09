import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { TokenGlyph } from "./TokenGlyph";
import { resetLogoCacheForTests } from "./logo-cache";
import { fakeCaches } from "./image-cache.testing";

const TX_A = "4eTBOaxZSSyGbpKlHyilxNKhXbocuZdiMBYIORjS4f0";
const TX_B = "Btm_9_fvwb7eXbQ2VkCvL0FY_x8JhNKe0cVUEEVfbxE";

function imageResponse(): Response {
  return new Response("png", { headers: { "content-type": "image/png" } });
}

let objectUrls = 0;

beforeEach(() => {
  objectUrls = 0;
  resetLogoCacheForTests();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:logo-${++objectUrls}` }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("token logo cache", () => {
  it("fetches a logo once, stores it by tx id, and draws it from a blob URL", async () => {
    const { entries, storage } = fakeCaches();
    const fetchImpl = vi.fn(async () => imageResponse());
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", fetchImpl);

    render(<TokenGlyph label="AB" logoUrl={`https://arweave.net/${TX_A}`} />);
    await waitFor(() => expect(document.querySelector("img")?.getAttribute("src")).toBe("blob:logo-1"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect([...entries.keys()]).toEqual([`https://token-logo.invalid/${TX_A}`]);
  });

  it("serves a stored logo from another gateway without the network", async () => {
    const { storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse()));
    render(<TokenGlyph label="AB" logoUrl={`https://arweave.net/${TX_A}`} />);
    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());
    cleanup();
    resetLogoCacheForTests();

    const fetchImpl = vi.fn(async () => imageResponse());
    vi.stubGlobal("fetch", fetchImpl);
    render(<TokenGlyph label="AB" logoUrl={`https://g8way.io/${TX_A}`} />);
    await waitFor(() => expect(document.querySelector("img")?.getAttribute("src")).toBe("blob:logo-2"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to the plain URL when the fetch fails", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("CORS"))));

    render(<TokenGlyph label="AB" logoUrl={`https://arweave.net/${TX_B}`} />);
    await waitFor(() =>
      expect(document.querySelector("img")?.getAttribute("src")).toBe(`https://arweave.net/${TX_B}`),
    );
    expect(entries.size).toBe(0);
  });

  it("doesn't store a response that isn't an image", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })));

    render(<TokenGlyph label="AB" logoUrl={`https://arweave.net/${TX_B}`} />);
    await waitFor(() =>
      expect(document.querySelector("img")?.getAttribute("src")).toBe(`https://arweave.net/${TX_B}`),
    );
    expect(entries.size).toBe(0);
  });

  it("draws a bundled data URI as-is", () => {
    const { storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    render(<TokenGlyph label="AR" logoUrl="data:image/svg+xml;utf8,%3Csvg%2F%3E" />);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("data:image/svg+xml;utf8,%3Csvg%2F%3E");
    expect(storage.open).not.toHaveBeenCalled();
  });
});
