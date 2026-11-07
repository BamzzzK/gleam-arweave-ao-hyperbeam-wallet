import { afterEach, describe, expect, it, vi } from "vitest";
import { WALLET_APPROVAL_ORIGIN, type WalletSummary } from "@gleam/core";
import type { CallerContext } from "@gleam/messaging/src/caller.ts";
import { ApprovalHandler } from "./handlers/approval";
import { createRuntime } from "./create-runtime";
import { createInMemoryPlatform } from "../testing/index";

const ORIGIN = "https://dapp.example";
const EXTENSION: CallerContext = { tier: "extension" };
const CONTENT_SCRIPT: CallerContext = { tier: "contentScript", origin: ORIGIN, tabId: 7 };
const TRANSACTION = { target: "r".repeat(43), quantity: "123", reward: "1", last_tx: "b".repeat(64) };

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function setupTwoWallets() {
  globalThis.fetch = vi.fn(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
  const platform = createInMemoryPlatform();
  const runtime = createRuntime(platform);
  const present = vi.spyOn(platform.approvalPresenter, "present");
  const a = (await runtime.dispatch("createWallet", { name: "A", password: "correct horse" }, EXTENSION)) as WalletSummary;
  const b = (await runtime.dispatch("createWallet", { name: "B", password: "correct horse" }, EXTENSION)) as WalletSummary;
  await runtime.dispatch("switchWallet", { walletId: a.id }, EXTENSION);
  await platform.storage.set("local:grants", [
    {
      origin: ORIGIN,
      walletId: a.id,
      permissions: ["ACCESS_ADDRESS", "SIGN_TRANSACTION"],
      createdAt: Date.now(),
      expiresAt: null,
      budget: null,
    },
  ]);
  return { platform, runtime, present, a, b };
}

describe("switching wallets with a dApp signing request pending", () => {
  it("rejects the request instead of leaving it bound to the previous wallet", async () => {
    const { runtime, present, b } = await setupTwoWallets();

    const pending = runtime.dispatch("providerCall", { method: "sign", params: { transaction: TRANSACTION } }, CONTENT_SCRIPT) as Promise<unknown>;
    void pending.catch(() => {});
    await vi.waitFor(() => expect(present).toHaveBeenCalledTimes(1));
    const requestId = present.mock.calls[0]![0];

    await runtime.dispatch("switchWallet", { walletId: b.id }, EXTENSION);

    await expect(pending).rejects.toThrow("The active wallet changed.");
    await expect(runtime.dispatch("getApproval", { requestId }, EXTENSION)).rejects.toThrow();
  });

  it("keeps the request when the same wallet is selected again", async () => {
    const { runtime, present, a } = await setupTwoWallets();

    const pending = runtime.dispatch("providerCall", { method: "sign", params: { transaction: TRANSACTION } }, CONTENT_SCRIPT) as Promise<unknown>;
    void pending.catch(() => {});
    await vi.waitFor(() => expect(present).toHaveBeenCalledTimes(1));
    const requestId = present.mock.calls[0]![0];

    await runtime.dispatch("switchWallet", { walletId: a.id }, EXTENSION);

    await expect(runtime.dispatch("getApproval", { requestId }, EXTENSION)).resolves.toMatchObject({ requestId });
    await runtime.dispatch("resolveApproval", { requestId, approved: false }, EXTENSION);
    await expect(pending).rejects.toThrow();
  });
});

describe("a dApp signing request's view", () => {
  it("carries the icon saved on the site's grant", async () => {
    const { platform, runtime, present, a } = await setupTwoWallets();
    await platform.storage.set("local:grants", [
      {
        origin: ORIGIN,
        walletId: a.id,
        permissions: ["ACCESS_ADDRESS", "SIGN_TRANSACTION"],
        createdAt: Date.now(),
        expiresAt: null,
        budget: null,
        icon: "https://dapp.example/icon.png",
      },
    ]);

    const pending = runtime.dispatch("providerCall", { method: "sign", params: { transaction: TRANSACTION } }, CONTENT_SCRIPT) as Promise<unknown>;
    void pending.catch(() => {});
    await vi.waitFor(() => expect(present).toHaveBeenCalledTimes(1));
    const requestId = present.mock.calls[0]![0];

    await expect(runtime.dispatch("getApproval", { requestId }, EXTENSION)).resolves.toMatchObject({ siteIcon: "https://dapp.example/icon.png" });
    await runtime.dispatch("resolveApproval", { requestId, approved: false }, EXTENSION);
  });
});

describe("adding a wallet with a dApp signing request pending", () => {
  it("rejects the request, since the new wallet becomes active", async () => {
    const { runtime, present } = await setupTwoWallets();

    const pending = runtime.dispatch("providerCall", { method: "sign", params: { transaction: TRANSACTION } }, CONTENT_SCRIPT) as Promise<unknown>;
    void pending.catch(() => {});
    await vi.waitFor(() => expect(present).toHaveBeenCalledTimes(1));

    await runtime.dispatch("createWallet", { name: "C", password: "correct horse" }, EXTENSION);

    await expect(pending).rejects.toThrow("The active wallet changed.");
  });
});

describe("a dApp signing request whose preview finishes after a wallet switch", () => {
  it("is rejected before it is shown", async () => {
    const platform = createInMemoryPlatform();
    const present = vi.spyOn(platform.approvalPresenter, "present");
    const keySession = {} as ConstructorParameters<typeof ApprovalHandler>[1];
    // The request captured wallet A, but B is active by the time it is stored.
    const handler = new ApprovalHandler(platform.storage, keySession, platform.approvalPresenter, undefined, undefined, async () => "wallet-b");

    await expect(
      handler.requestApproval({
        kind: "signMessage",
        origin: ORIGIN,
        walletId: "wallet-a",
        payload: new Uint8Array([1]),
        hashAlgorithm: "SHA-256",
        tags: [],
      }),
    ).rejects.toThrow("The active wallet changed.");
    expect(present).not.toHaveBeenCalled();
    expect(await platform.storage.get("session:pendingApprovals")).toEqual([]);
  });

  it("leaves Gleam's own requests for a chosen wallet alone", async () => {
    const platform = createInMemoryPlatform();
    const present = vi.spyOn(platform.approvalPresenter, "present");
    const keySession = {} as ConstructorParameters<typeof ApprovalHandler>[1];
    const handler = new ApprovalHandler(platform.storage, keySession, platform.approvalPresenter, undefined, undefined, async () => "wallet-b");

    const pending = handler.requestApproval({
      kind: "pointsProof",
      origin: WALLET_APPROVAL_ORIGIN,
      walletId: "wallet-a",
      payload: new Uint8Array([1]),
      tags: [],
    });
    void pending.catch(() => {});

    await vi.waitFor(() => expect(present).toHaveBeenCalledTimes(1));
  });
});
