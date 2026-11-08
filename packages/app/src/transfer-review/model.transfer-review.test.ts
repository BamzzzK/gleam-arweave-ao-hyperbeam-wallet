import { describe, expect, it } from "vitest";
import type { SigningApprovalPreview } from "@gleam/core";
import { HIDDEN_AMOUNT } from "@gleam/ui/src/format/currency.ts";
import { t } from "../i18n";
import {
  balanceAfterParts,
  glyphLabel,
  groupDigits,
  recipientsOf,
  showsWarning,
  transferRequestFromDevice,
  warningReasons,
  transferRequestFromPreview,
  type TransferRequest,
} from "./model";

const R = "r".repeat(43);
const P = "p".repeat(43);

const BASE: SigningApprovalPreview = {
  kind: "dispatch",
  recipient: R,
  amount: "5",
  fee: "1",
  token: null,
  tokenDenomination: null,
  tokenTicker: null,
  decodedData: null,
  tags: [],
  payloadHash: "h",
  items: null,
};

function request(overrides: Partial<TransferRequest["transfers"][number]> = {}, fee: string | null = "1"): TransferRequest {
  return {
    transfers: [
      { token: null, ticker: "AR", denomination: 12, amount: "5", recipient: R, part: { tags: [], decodedData: null, payloadHash: null }, index: 0, ...overrides },
    ],
    others: [],
    fee,
    method: null,
    itemCount: 1,
  };
}

describe("groupDigits", () => {
  it("groups by thousands with narrow no-break spaces", () => {
    expect(groupDigits("1500000")).toBe("1 500 000");
    expect(groupDigits("999")).toBe("999");
  });
});

describe("transferRequestFromPreview", () => {
  it("reads an AR send at 12 decimals and keeps its payload hash", () => {
    const parsed = transferRequestFromPreview(BASE)!;
    expect(parsed.transfers[0]).toMatchObject({ token: null, ticker: "AR", denomination: 12, amount: "5" });
    expect(parsed.transfers[0]!.part.payloadHash).toBe("h");
    expect(parsed.method).toBe("dispatch");
  });

  it("drops the payload hash of a wallet send and names no method", () => {
    const parsed = transferRequestFromPreview({ ...BASE, kind: "transfer" })!;
    expect(parsed.transfers[0]!.part.payloadHash).toBeNull();
    expect(parsed.method).toBeNull();
  });

  it("is null for a request that moves nothing", () => {
    expect(transferRequestFromPreview({ ...BASE, recipient: null })).toBeNull();
    expect(
      transferRequestFromPreview({
        ...BASE,
        kind: "signDataItem",
        recipient: null,
        items: [{ decodedData: null, tags: [], target: null, payloadHash: "x", transfer: null }],
      }),
    ).toBeNull();
  });
});

describe("transferRequestFromDevice", () => {
  it("is null when any payload moves nothing", () => {
    expect(transferRequestFromDevice([{ kind: "dataItem", target: null, dataSize: 3 }], undefined, null)).toBeNull();
  });

  it("scales only the token the preview resolved, and sums the AR fees", () => {
    const parsed = transferRequestFromDevice(
      [
        { kind: "l1TokenTransfer", process: P, recipient: R, quantity: "10", fee: "2" },
        { kind: "aoTransfer", process: "z".repeat(43), recipient: R, quantity: "3" },
      ],
      { processId: P, denomination: 1, ticker: "TOK" },
      null,
    )!;
    expect(parsed.transfers.map((transfer) => transfer.denomination)).toEqual([1, null]);
    expect(parsed.fee).toBe("2");
    expect(recipientsOf(parsed)).toEqual([R]);
  });
});

describe("balanceAfterParts", () => {
  it("takes the amount and the fee off an AR balance", () => {
    expect(balanceAfterParts({ balances: { arBalance: "1000000000000", tokenBalances: [] } }, request({ amount: "400000000000" }, "100000000000"))).toEqual([
      { amount: "0.5", ticker: "AR" },
    ]);
  });

  it("keeps a token's ticker apart from its amount, and leaves a ticker that echoes the id out", () => {
    const context = {
      balances: {
        arBalance: "0",
        tokenBalances: [
          { address: R, processId: P, ticker: "\u202EXYZ", denomination: 6, name: "X", quantity: "5000000", source: "watched" as const },
        ],
      },
    };
    expect(balanceAfterParts(context, request({ token: P, ticker: "\u202EXYZ", denomination: 6, amount: "2500000" }, null))).toEqual([
      { amount: "2.5", ticker: "\u202EXYZ" },
    ]);
    expect(balanceAfterParts(context, request({ token: P, ticker: P, denomination: 6, amount: "2500000" }, null))).toEqual([
      { amount: "2.5", ticker: null },
    ]);
    expect(balanceAfterParts(context, request({ token: P, ticker: "  ", denomination: 6, amount: "2500000" }, null))).toEqual([
      { amount: "2.5", ticker: null },
    ]);
  });

  it("masks every amount while balances are hidden", () => {
    expect(balanceAfterParts({ balances: { arBalance: "1000000000000", tokenBalances: [] }, balancesHidden: true }, request())).toEqual([
      { amount: HIDDEN_AMOUNT, ticker: null },
    ]);
  });

  it("leaves out a balance the request would overdraw", () => {
    expect(balanceAfterParts({ balances: { arBalance: "5", tokenBalances: [] } }, request())).toBeUndefined();
  });
});

describe("glyphLabel", () => {
  it("drops hidden characters from a ticker's initials", () => {
    expect(glyphLabel({ token: P, ticker: "\u202Exyz", denomination: 6, amount: "1", recipient: R })).toBe("XY");
    expect(glyphLabel({ token: P, ticker: "\u202E\u200B", denomination: 6, amount: "1", recipient: R })).toBe("?");
    expect(glyphLabel({ token: P, ticker: " \u202E ", denomination: 6, amount: "1", recipient: R })).toBe("?");
  });
});

describe("showsWarning", () => {
  it("warns for an unknown scale even without a recipient risk", () => {
    expect(showsWarning(request({ token: P, denomination: null }), null)).toBe(true);
    expect(showsWarning(request(), null)).toBe(false);
    expect(showsWarning(request(), { firstTime: false, lookalikeOf: null, unchecked: true })).toBe(true);
  });

  it("warns for a token transfer the wallet couldn't read, from the preview or the device", () => {
    const fromPreview = transferRequestFromPreview({ ...BASE, unreadableTokenTransfer: true })!;
    expect(showsWarning(fromPreview, null)).toBe(true);
    expect(warningReasons(fromPreview, t)).toEqual(["This may be a token transfer Gleam can't read. Check the tags."]);
    const fromDevice = transferRequestFromDevice(
      [{ kind: "transaction", recipient: P, quantity: "0", fee: "1", dataSize: "0", unreadableTokenTransfer: true }],
      undefined,
      null,
    )!;
    expect(showsWarning(fromDevice, null)).toBe(true);
    expect(showsWarning(transferRequestFromPreview(BASE)!, null)).toBe(false);
  });

  it("warns for a batch when any data item is a token transfer the wallet couldn't read", () => {
    const item = { decodedData: null, tags: [], target: P, payloadHash: "h" };
    const transfer = { token: P, recipient: R, amount: "5", tokenDenomination: 12, tokenTicker: "T" };
    const batch = (unreadable: boolean): SigningApprovalPreview => ({
      ...BASE,
      kind: "batchSignDataItem",
      items: [
        { ...item, transfer },
        { ...item, transfer: null, ...(unreadable ? { unreadableTokenTransfer: true } : {}) },
      ],
    });
    const warned = transferRequestFromPreview(batch(true))!;
    expect(warned.unreadableTokenTransfer).toBe(true);
    expect(showsWarning(warned, null)).toBe(true);
    expect(showsWarning(transferRequestFromPreview(batch(false))!, null)).toBe(false);
  });
});
