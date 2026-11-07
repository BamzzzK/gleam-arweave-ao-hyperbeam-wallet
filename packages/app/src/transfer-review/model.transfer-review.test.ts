import { describe, expect, it } from "vitest";
import type { SigningApprovalPreview } from "@gleam/core";
import {
  balanceAfterText,
  groupDigits,
  recipientsOf,
  showsWarning,
  transferRequestFromDevice,
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

describe("balanceAfterText", () => {
  it("takes the amount and the fee off an AR balance", () => {
    expect(balanceAfterText({ balances: { arBalance: "1000000000000", tokenBalances: [] } }, request({ amount: "400000000000" }, "100000000000"))).toBe(
      "0.5 AR",
    );
  });

  it("leaves out a balance the request would overdraw", () => {
    expect(balanceAfterText({ balances: { arBalance: "5", tokenBalances: [] } }, request())).toBeUndefined();
  });
});

describe("showsWarning", () => {
  it("warns for an unknown scale even without a recipient risk", () => {
    expect(showsWarning(request({ token: P, denomination: null }), null)).toBe(true);
    expect(showsWarning(request(), null)).toBe(false);
    expect(showsWarning(request(), { firstTime: false, lookalikeOf: null, unchecked: true })).toBe(true);
  });
});
