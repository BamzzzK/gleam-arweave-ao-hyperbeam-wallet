import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { fakeAppPlatform, renderWithPlatform } from "../../../app-platform/testing";
import { AddWalletStart } from "./AddWalletStart";
import { ExistingWallet } from "./ExistingWallet";

afterEach(cleanup);

const handlers = {
  onImport: vi.fn(),
  onImportPhrase: vi.fn(),
  onConnectKeystone: vi.fn(), onConnectLedger: vi.fn(),
  onWatch: vi.fn(),
};

const screens = {
  ExistingWallet: () => <ExistingWallet onBack={vi.fn()} {...handlers} />,
  AddWalletStart: () => <AddWalletStart onBack={vi.fn()} onCreate={vi.fn()} {...handlers} />,
};

describe.each(Object.entries(screens))("%s hardware wallets", (_name, Screen) => {
  it("lists both devices when the platform supports both", () => {
    renderWithPlatform(<Screen />, fakeAppPlatform({ capabilities: { hardwareWallets: { ledger: true, keystone: true } } }));
    expect(screen.getByRole("button", { name: "Ledger" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keystone" })).toBeTruthy();
  });

  it("lists only Ledger when only Ledger is supported", () => {
    renderWithPlatform(<Screen />, fakeAppPlatform({ capabilities: { hardwareWallets: { keystone: false } } }));
    expect(screen.getByRole("button", { name: "Ledger" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keystone" })).toBeNull();
  });

  it("lists only Keystone when only Keystone is supported", () => {
    renderWithPlatform(<Screen />, fakeAppPlatform({ capabilities: { hardwareWallets: { ledger: false } } }));
    expect(screen.getByRole("button", { name: "Keystone" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ledger" })).toBeNull();
  });

  it("drops the whole section when neither is supported", () => {
    renderWithPlatform(
      <Screen />,
      fakeAppPlatform({ capabilities: { hardwareWallets: { ledger: false, keystone: false } } }),
    );
    expect(screen.queryByRole("region", { name: "Hardware wallet" })).toBeNull();
    expect(screen.queryByText("Hardware wallet")).toBeNull();
    expect(screen.getByRole("button", { name: /Keyfile/ })).toBeTruthy();
  });
});

describe.each(Object.entries(screens))("%s recovery phrase", (_name, Screen) => {
  it("offers the recovery phrase ahead of the keyfile", () => {
    renderWithPlatform(<Screen />, fakeAppPlatform());
    const buttons = screen.getAllByRole("button").map((button) => button.textContent ?? "");
    const phrase = buttons.findIndex((text) => text.includes("Recovery phrase"));
    const keyfile = buttons.findIndex((text) => text.includes("Keyfile"));
    expect(phrase).toBeGreaterThanOrEqual(0);
    expect(phrase).toBeLessThan(keyfile);
    screen.getAllByRole("button")[phrase]!.click();
    expect(handlers.onImportPhrase).toHaveBeenCalled();
  });
});

describe.each(Object.entries(screens))("%s grouping", (_name, Screen) => {
  it("puts everything from another wallet under one heading", () => {
    renderWithPlatform(<Screen />, fakeAppPlatform());
    const section = screen.getByRole("region", { name: "From another wallet" });
    const rows = within(section).getAllByRole("button").map((button) => button.textContent ?? "");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/Recovery phrase/);
    expect(rows[1]).toMatch(/Keyfile/);
    expect(rows[2]).toMatch(/Watch an address/);
    expect(screen.queryByText("From a file")).toBeNull();
    expect(screen.queryByText("Address only")).toBeNull();
  });
});
