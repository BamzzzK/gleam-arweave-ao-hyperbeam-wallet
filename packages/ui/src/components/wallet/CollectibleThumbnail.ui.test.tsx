import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CollectibleThumbnail, resetCollectibleImageCacheForTests } from "./CollectibleThumbnail";
import { fakeCaches } from "./image-cache.testing";

afterEach(cleanup);

describe("CollectibleThumbnail", () => {
  it("loads the image through a lazy, referrer-less <img>", () => {
    render(<CollectibleThumbnail name="Frog" imageUrl="https://arweave.net/abc" />);
    const img = screen.getByAltText("Frog");
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("https://arweave.net/abc");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("leaves the alt text empty when decorative", () => {
    const { container } = render(<CollectibleThumbnail name={"\u202EgorF"} imageUrl="https://arweave.net/abc" decorative />);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
  });

  it("shows the plain tile when there is no image", () => {
    render(<CollectibleThumbnail name="Doc" />);
    expect(screen.getByTestId("collectible-placeholder")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("pulses until the image loads", () => {
    render(<CollectibleThumbnail name="Frog" imageUrl="https://arweave.net/abc" />);
    const tile = screen.getByTestId("collectible-tile");
    expect(tile.className).toContain("gleam-cached-pulse");
    fireEvent.load(screen.getByAltText("Frog"));
    expect(tile.className).not.toContain("gleam-cached-pulse");
  });

  it("keeps pulsing and retries a failed load before showing the file icon", () => {
    vi.useFakeTimers();
    try {
      render(<CollectibleThumbnail name="Frog" imageUrl="https://arweave.net/broken" />);
      for (const delay of [1500, 4000, 10_000]) {
        fireEvent.error(screen.getByAltText("Frog"));
        expect(screen.queryByTestId("collectible-placeholder")).toBeNull();
        expect(screen.getByTestId("collectible-tile").className).toContain("gleam-cached-pulse");
        act(() => vi.advanceTimersByTime(delay));
      }
      fireEvent.error(screen.getByAltText("Frog"));
      expect(screen.queryByAltText("Frog")).toBeNull();
      expect(screen.getByTestId("collectible-placeholder")).toBeTruthy();
      expect(screen.getByTestId("collectible-tile").className).not.toContain("gleam-cached-pulse");
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries at once when the browser comes back online", () => {
    render(<CollectibleThumbnail name="Frog" imageUrl="https://arweave.net/flaky" />);
    fireEvent.error(screen.getByAltText("Frog"));
    expect(screen.queryByAltText("Frog")).toBeNull();
    act(() => void window.dispatchEvent(new Event("online")));
    fireEvent.load(screen.getByAltText("Frog"));
    expect(screen.getByTestId("collectible-tile").className).not.toContain("gleam-cached-pulse");
  });
});

describe("CollectibleThumbnail image cache", () => {
  const TX = "4eTBOaxZSSyGbpKlHyilxNKhXbocuZdiMBYIORjS4f0";
  let objectUrls = 0;

  beforeEach(() => {
    objectUrls = 0;
    resetCollectibleImageCacheForTests();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:nft-${++objectUrls}`, revokeObjectURL: () => {} }));
  });

  afterEach(() => vi.unstubAllGlobals());

  function respond(type: string, body = "img") {
    return vi.fn(async () => new Response(body, { headers: { "content-type": type } }));
  }

  it("stores a raster image by tx id and serves it again without the network", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", respond("image/png"));
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe("blob:nft-1"));
    expect([...entries.keys()]).toEqual([`https://collectible-image.invalid/${TX}`]);

    cleanup();
    resetCollectibleImageCacheForTests();
    const fetchImpl = respond("image/png");
    vi.stubGlobal("fetch", fetchImpl);
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe("blob:nft-2"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("draws an SVG from the gateway and never stores it", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", respond("image/svg+xml", "<svg/>"));
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe(`https://arweave.net/${TX}`));
    expect(entries.size).toBe(0);
  });

  it("draws an oversized image from the gateway and never stores it", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", respond("image/png", "x".repeat(5 * 1024 * 1024 + 1)));
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe(`https://arweave.net/${TX}`));
    expect(entries.size).toBe(0);
  });

  it("never stores the empty body a gateway can answer 200 with", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal("fetch", respond("image/webp", ""));
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe(`https://arweave.net/${TX}`));
    expect(entries.size).toBe(0);
  });

  it("never stores a body cut short of its declared length", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("img", { headers: { "content-type": "image/png", "content-length": "9000" } })),
    );
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe(`https://arweave.net/${TX}`));
    expect(entries.size).toBe(0);
  });

  it("drops a stored copy that won't draw and fetches it again on the retry", async () => {
    const { entries, storage } = fakeCaches();
    vi.stubGlobal("caches", storage);
    const fetchImpl = respond("image/png");
    vi.stubGlobal("fetch", fetchImpl);
    render(<CollectibleThumbnail name="Frog" imageUrl={`https://arweave.net/${TX}`} />);
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe("blob:nft-1"));

    fireEvent.error(screen.getByAltText("Frog"));
    await waitFor(() => expect(entries.size).toBe(0));
    act(() => void window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(screen.getByAltText("Frog").getAttribute("src")).toBe("blob:nft-2"));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(entries.size).toBe(1);
  });
});
