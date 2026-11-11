import { describe, expect, it } from "vitest";
import { explorerUrlFor, trimTrailingSlashes } from "./network";

describe("explorerUrlFor", () => {
  it("builds a lunar.arweave.net explorer link for a tx id", () => {
    expect(explorerUrlFor("test-tx-id-123")).toBe("https://lunar.arweave.net/#/explorer/test-tx-id-123");
  });

  it("builds the same explorer link shape for a wallet address", () => {
    expect(explorerUrlFor("some-wallet-address")).toBe("https://lunar.arweave.net/#/explorer/some-wallet-address");
  });
});

describe("trimTrailingSlashes", () => {
  it("drops every trailing slash and keeps the path", () => {
    expect(trimTrailingSlashes("https://upload.ardrive.io/v1//")).toBe("https://upload.ardrive.io/v1");
    expect(trimTrailingSlashes("https://arweave.net")).toBe("https://arweave.net");
    expect(trimTrailingSlashes("///")).toBe("");
  });

  it("stays fast on a long run of slashes that doesn't end the string", () => {
    const url = `https://a${"/".repeat(100_000)}x`;
    const started = performance.now();
    expect(trimTrailingSlashes(url)).toBe(url);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
