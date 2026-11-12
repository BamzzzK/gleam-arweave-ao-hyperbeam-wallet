import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { DeviceSignPanelProps } from "@gleam/app/src/approval/device-panels.tsx";

const createKeystonePanel = vi.fn(() => (props: DeviceSignPanelProps) => <p>keystone panel for {props.wallet.address}</p>);

vi.mock("@gleam/keystone/src/KeystonePanel.tsx", () => ({ createKeystonePanel }));

afterEach(cleanup);

beforeEach(() => {
  vi.resetModules();
  createKeystonePanel.mockClear();
});

function props(onError = vi.fn()): DeviceSignPanelProps {
  return {
    payloads: [],
    wallet: { method: "keystone", device: null, address: "a".repeat(43), publicKey: "n" },
    onSignatures: vi.fn(),
    onActivity: vi.fn(),
    onError,
    onCancel: vi.fn(),
  };
}

describe("LazyKeystonePanel", () => {
  it("loads the Keystone panel on first render, once, and passes the props through", async () => {
    const { LazyKeystonePanel } = await import("./LazyKeystonePanel");
    const first = render(<LazyKeystonePanel {...props()} />);
    expect(await screen.findByText(`keystone panel for ${"a".repeat(43)}`)).toBeTruthy();
    first.unmount();
    render(<LazyKeystonePanel {...props()} />);
    expect(await screen.findByText(/keystone panel for/)).toBeTruthy();
    expect(createKeystonePanel).toHaveBeenCalledTimes(1);
  });

  it("reports a failed load to the approval screen", async () => {
    createKeystonePanel.mockImplementationOnce(() => {
      throw new Error("chunk failed");
    });
    const { LazyKeystonePanel } = await import("./LazyKeystonePanel");
    const onError = vi.fn();
    render(<LazyKeystonePanel {...props(onError)} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith("chunk failed"));
  });
});
