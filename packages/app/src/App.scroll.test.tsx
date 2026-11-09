import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type { RuntimePort, WalletState } from "@gleam/core";
import { fakeAppPlatform, renderWithPlatform as render } from "./app-platform/testing";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const unlocked = {
  wallets: [{ id: "w1", address: "addr", name: "Main", method: "jwk", publicKey: "pk", createdAt: 0, updatedAt: 0, backupConfirmedAt: null }],
  activeWalletId: "w1",
  session: { unlockedWalletIds: ["w1"], unlockedAt: 0, lastActivityAt: 0 },
} as unknown as WalletState;

const runtime: RuntimePort = {
  send: vi.fn(async ({ type }: { type: string }) => {
    if (type === "getState") return unlocked;
    if (type === "getThemePreference") return { theme: "light" };
    if (type === "getLockSettings") return { autoLockTimeout: "1hr" };
    if (type === "getPasskeyStatus") return { enrolled: false };
    if (type === "getBalance") return "0";
    if (type === "getTokenBalances") return [];
    if (type === "getActivity") return { entries: [], cursor: null };
    if (type === "getConnectedApps") return [];
    return null;
  }) as unknown as RuntimePort["send"],
  onMessage: () => () => {},
};

describe("screen changes", () => {
  it("open a screen at the top, whatever the home screen was scrolled to", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    await act(async () => {
      render(<App layout="phone" />, fakeAppPlatform({ runtime }));
    });
    scrollTo.mockClear();

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    });

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
