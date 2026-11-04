import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithPlatform as render } from "../../../app-platform/testing";
import type { DisplaySettings, LockSettings, NetworkSettings, RuntimePort, ThemeSettings } from "@gleam/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsHomeView } from "./SettingsHomeView";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

function fakeRuntime(overrides: Partial<RuntimePort> = {}): RuntimePort {
  return {
    send: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    ...overrides,
  };
}

const LOCK_SETTINGS: LockSettings = { autoLockTimeout: "never" };
const NETWORK_SETTINGS: NetworkSettings = { gatewayUrl: "https://arweave.net", peers: [], activePeerUrl: null };
const DISPLAY_SETTINGS: DisplaySettings = { currency: "EUR", header: "full", tokenLogos: true, tokenRows: "detailed", headline: "total", balancesHidden: false };

function successfulSend(overrides: { theme?: ThemeSettings["theme"] } = {}): RuntimePort["send"] {
  return vi.fn(async ({ type }: { type: string }) => {
    if (type === "getLockSettings") return LOCK_SETTINGS;
    if (type === "getNetworkSettings") return NETWORK_SETTINGS;
    if (type === "getThemePreference") return { theme: overrides.theme ?? "light" } satisfies ThemeSettings;
    if (type === "setThemePreference") return undefined;
    if (type === "getScanStats") return null;
    if (type === "getDisplaySettings") return DISPLAY_SETTINGS;
    if (type === "setDisplaySettings") return undefined;
    throw new Error(`Unexpected message type "${type}"`);
  }) as RuntimePort["send"];
}

function renderSettingsHome(overrides: Partial<Parameters<typeof SettingsHomeView>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
    <SettingsHomeView
      runtime={fakeRuntime({ send: successfulSend() })}
      onBack={vi.fn()}
      onOpenLockSettings={vi.fn()}
      onOpenConnectedApps={vi.fn()}
      onOpenNetworkPeers={vi.fn()}
      onOpenManageTokens={vi.fn()}
      onOpenContacts={vi.fn()}
      onOpenDisplayCurrency={vi.fn()}
      onOpenLanguage={vi.fn()}
      onOpenHomeScreen={vi.fn()}
      onOpenFeedback={vi.fn()}
      {...overrides}
    />
    </QueryClientProvider>,
  );
}

describe("SettingsHomeView", () => {
  it("shows the current auto-lock and gateway values as row labels", async () => {
    renderSettingsHome();

    await waitFor(() => expect(screen.getByText("Never")).toBeTruthy());
    expect(screen.getByText("arweave.net")).toBeTruthy();
  });

  it("calls onOpenFeedback when the feedback card is pressed", async () => {
    const onOpenFeedback = vi.fn();
    renderSettingsHome({ onOpenFeedback });

    fireEvent.click(screen.getByRole("button", { name: /Got an issue or suggestion\?/ }));

    expect(onOpenFeedback).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Never")).toBeTruthy());
  });

  it("links to the GitHub source in a new tab", async () => {
    renderSettingsHome();

    const link = screen.getByRole("link", { name: /Gleam is open source/ });
    expect(link.getAttribute("href")).toBe("https://github.com/skyf0xx/gleam-arweave-ao-hyperbeam-wallet");
    expect(link.getAttribute("target")).toBe("_blank");
    await waitFor(() => expect(screen.getByText("Never")).toBeTruthy());
  });

  it("calls onOpenLockSettings when the Lock & unlock row is pressed", async () => {
    const onOpenLockSettings = vi.fn();
    renderSettingsHome({ onOpenLockSettings });

    await waitFor(() => expect(screen.getByText("Lock & unlock")).toBeTruthy());
    fireEvent.click(screen.getByText("Lock & unlock"));

    expect(onOpenLockSettings).toHaveBeenCalled();
  });

  it("hides the Lock & unlock row when there is no lock to open (vault without a password)", async () => {
    renderSettingsHome({ onOpenLockSettings: undefined });

    await waitFor(() => expect(screen.getByText("arweave.net")).toBeTruthy());
    expect(screen.queryByText("Lock & unlock")).toBeNull();
  });

  it("calls onOpenConnectedApps when the Connected apps row is pressed", async () => {
    const onOpenConnectedApps = vi.fn();
    renderSettingsHome({ onOpenConnectedApps });

    await waitFor(() => expect(screen.getByText("Connected apps")).toBeTruthy());
    fireEvent.click(screen.getByText("Connected apps"));

    expect(onOpenConnectedApps).toHaveBeenCalled();
  });

  it("calls onOpenNetworkPeers when the Network & peers row is pressed", async () => {
    const onOpenNetworkPeers = vi.fn();
    renderSettingsHome({ onOpenNetworkPeers });

    await waitFor(() => expect(screen.getByText("Network & peers")).toBeTruthy());
    fireEvent.click(screen.getByText("Network & peers"));

    expect(onOpenNetworkPeers).toHaveBeenCalled();
  });

  it("calls onOpenManageTokens when the Manage tokens row is pressed", async () => {
    const onOpenManageTokens = vi.fn();
    renderSettingsHome({ onOpenManageTokens });

    await waitFor(() => expect(screen.getByText("Manage tokens")).toBeTruthy());
    fireEvent.click(screen.getByText("Manage tokens"));

    expect(onOpenManageTokens).toHaveBeenCalled();
  });

  it("calls onOpenContacts when the Contacts row is pressed", async () => {
    const onOpenContacts = vi.fn();
    renderSettingsHome({ onOpenContacts });

    await waitFor(() => expect(screen.getByText("Contacts")).toBeTruthy());
    fireEvent.click(screen.getByText("Contacts"));

    expect(onOpenContacts).toHaveBeenCalled();
  });

  it("calls onBack when the header back button is pressed", async () => {
    const onBack = vi.fn();
    renderSettingsHome({ onBack });

    await waitFor(() => expect(screen.getByText("Lock & unlock")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("flipping the Dark mode toggle persists via setThemePreference and applies data-theme immediately", async () => {
    const send = successfulSend({ theme: "light" });
    renderSettingsHome({ runtime: fakeRuntime({ send }) });

    await waitFor(() =>
      expect(screen.getByRole("menuitemcheckbox", { name: /Dark mode/i }).getAttribute("aria-checked")).toBe(
        "false",
      ),
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Dark mode/i }));

    await waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("dark"));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ type: "setThemePreference", payload: { theme: "dark" } }),
    );
  });

  it("reverts the toggle and data-theme if setThemePreference fails", async () => {
    const send = vi.fn(async ({ type }: { type: string }) => {
      if (type === "getLockSettings") return LOCK_SETTINGS;
      if (type === "getNetworkSettings") return NETWORK_SETTINGS;
      if (type === "getThemePreference") return { theme: "light" } satisfies ThemeSettings;
      if (type === "setThemePreference") throw new Error("write failed");
      throw new Error(`Unexpected message type "${type}"`);
    }) as RuntimePort["send"];
    renderSettingsHome({ runtime: fakeRuntime({ send }) });

    await waitFor(() =>
      expect(screen.getByRole("menuitemcheckbox", { name: /Dark mode/i }).getAttribute("aria-checked")).toBe(
        "false",
      ),
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Dark mode/i }));

    await waitFor(() =>
      expect(screen.getByRole("menuitemcheckbox", { name: /Dark mode/i }).getAttribute("aria-checked")).toBe(
        "false",
      ),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("does not render the removed Import & export or About placeholder rows", async () => {
    renderSettingsHome();

    await waitFor(() => expect(screen.getByText("Lock & unlock")).toBeTruthy());
    expect(screen.queryByText("Import & export")).toBeNull();
    expect(screen.queryByText("About")).toBeNull();
  });

  it("shows the display currency and opens the picker from its row", async () => {
    const onOpenDisplayCurrency = vi.fn();
    renderSettingsHome({ onOpenDisplayCurrency });

    await waitFor(() => expect(screen.getByText("EUR")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Currency" }));

    expect(onOpenDisplayCurrency).toHaveBeenCalled();
  });

  it("opens Home screen from a row that shows the header style", async () => {
    const onOpenHomeScreen = vi.fn();
    renderSettingsHome({ onOpenHomeScreen });

    const row = await screen.findByRole("button", { name: "Home screen" });
    await waitFor(() => expect(row.textContent).toContain("Full chart"));
    fireEvent.click(row);

    expect(onOpenHomeScreen).toHaveBeenCalled();
  });

  it("keeps the home screen's layout controls off the settings screen", async () => {
    renderSettingsHome();

    await waitFor(() => expect(screen.getByText("EUR")).toBeTruthy());
    expect(screen.queryByLabelText("Main balance")).toBeNull();
    expect(screen.queryByLabelText("Header")).toBeNull();
    expect(screen.queryByLabelText("Token rows")).toBeNull();
    expect(screen.queryByRole("menuitemcheckbox", { name: /Token logos/i })).toBeNull();
  });

  it("lists network under Wallet with no section of its own", async () => {
    renderSettingsHome();

    await waitFor(() => expect(screen.getByText("arweave.net")).toBeTruthy());
    expect(screen.queryByRole("region", { name: "Network" })).toBeNull();
    const wallet = screen.getByRole("region", { name: "Wallet" });
    expect(within(wallet).getByRole("button", { name: "Network & peers" })).toBeTruthy();
  });

  it("describes only the rows whose titles need it", async () => {
    renderSettingsHome();

    await waitFor(() => expect(screen.getByText("EUR")).toBeTruthy());
    expect(screen.getByText("Auto-lock and passkey")).toBeTruthy();
    expect(screen.getByText("Gateway and AO nodes")).toBeTruthy();
    for (const name of ["Connected apps", "Manage tokens", "Contacts", "Currency", "Language", "Home screen"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-describedby")).toBeNull();
    }
  });
});
