import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DisplaySettings, RuntimePort } from "@gleam/core";
import { renderWithPlatform as render } from "../../../app-platform/testing";
import { HomeScreenView } from "./HomeScreenView";

afterEach(cleanup);

const DISPLAY_SETTINGS: DisplaySettings = {
  currency: "EUR",
  header: "full",
  tokenLogos: true,
  tokenRows: "detailed",
  headline: "total",
  balancesHidden: false,
};

function renderHomeScreen(onBack = vi.fn()) {
  const send = vi.fn(async ({ type }: { type: string }) => {
    if (type === "getDisplaySettings") return DISPLAY_SETTINGS;
    if (type === "setDisplaySettings") return undefined;
    throw new Error(`Unexpected message type "${type}"`);
  }) as RuntimePort["send"];
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HomeScreenView runtime={{ send, onMessage: vi.fn(() => () => {}) }} onBack={onBack} />
    </QueryClientProvider>,
  );
  return { send, onBack };
}

describe("HomeScreenView", () => {
  it("saves the main balance, header and token row choices", async () => {
    const { send } = renderHomeScreen();

    const select = await screen.findByLabelText("Main balance");
    await waitFor(() => expect((select as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(select, { target: { value: "AO" } });
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ type: "setDisplaySettings", payload: { ...DISPLAY_SETTINGS, headline: "AO" } }),
    );

    const header = screen.getByLabelText("Header") as HTMLSelectElement;
    expect(header.value).toBe("full");
    fireEvent.change(header, { target: { value: "minimal" } });
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        type: "setDisplaySettings",
        payload: { ...DISPLAY_SETTINGS, headline: "AO", header: "minimal" },
      }),
    );
    expect((screen.getByLabelText("Header") as HTMLSelectElement).value).toBe("minimal");

    fireEvent.change(screen.getByLabelText("Token rows"), { target: { value: "simple" } });
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        type: "setDisplaySettings",
        payload: { ...DISPLAY_SETTINGS, headline: "AO", header: "minimal", tokenRows: "simple" },
      }),
    );
  });

  it("starts with token logos on and saves turning them off", async () => {
    const { send } = renderHomeScreen();

    const toggle = await screen.findByRole("menuitemcheckbox", { name: /Token logos/i });
    await waitFor(() => expect(toggle.getAttribute("aria-disabled")).not.toBe("true"));
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ type: "setDisplaySettings", payload: { ...DISPLAY_SETTINGS, tokenLogos: false } }),
    );
  });

  it("goes back to settings", async () => {
    const { onBack } = renderHomeScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });
});
