import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { SigningApprovalPreview } from "@gleam/core";
import { SigningApprovalScreen } from "./SigningApprovalScreen";
import { UntrustedText, escapeHiddenCharacters } from "./UntrustedText";

afterEach(() => {
  cleanup();
});

const HIDDEN = /[\p{Cf}\u2028\u2029]/u;

const MESSAGE = "const amount = /*\u202e*/100.0/*\u202c*/;";

const SIGN_MESSAGE_PREVIEW: SigningApprovalPreview = {
  kind: "signMessage",
  recipient: null,
  amount: null,
  fee: null,
  token: null,
  tokenDenomination: null,
  tokenTicker: null,
  decodedData: MESSAGE,
  tags: [],
  payloadHash: "1a9d4f7c2e5b8a0f3c6d9b2e5a8f1c4d7b0e3a6c9f2b5d8e1a4c7f0b3d6e9a2c",
  items: null,
};

describe("escapeHiddenCharacters", () => {
  it("splits out bidi, zero-width and line-separator characters as code points", () => {
    expect(escapeHiddenCharacters("a\u202eb\u200bc\u2028d\u{e0041}")).toEqual([
      "a",
      { codePoint: "U+202E" },
      "b",
      { codePoint: "U+200B" },
      "c",
      { codePoint: "U+2028" },
      "d",
      { codePoint: "U+E0041" },
    ]);
  });

  it("leaves ordinary text, newlines, tabs and right-to-left letters alone", () => {
    expect(escapeHiddenCharacters("שלום 100\n\tok")).toEqual(["שלום 100\n\tok"]);
  });
});

describe("UntrustedText", () => {
  it("renders hidden characters as visible code points in an isolated left-to-right run", () => {
    const { container } = render(<UntrustedText text={MESSAGE} />);
    const run = container.firstElementChild!;
    expect(run.tagName).toBe("BDI");
    expect(run.getAttribute("dir")).toBe("ltr");
    expect(run.textContent).toBe("const amount = /*<U+202E>*/100.0/*<U+202C>*/;");
  });
});

describe("SigningApprovalScreen hidden characters", () => {
  it("shows bidi controls in a message as code points instead of letting them reorder it", () => {
    const { container } = render(
      <SigningApprovalScreen origin="https://example.com" preview={SIGN_MESSAGE_PREVIEW} onReject={vi.fn()} onSign={vi.fn()} />,
    );
    expect(HIDDEN.test(container.textContent!)).toBe(false);
    expect(container.textContent).toContain("/*<U+202E>*/100.0/*<U+202C>*/");
  });

  it("shows hidden characters in tag names and values, and in batch items", () => {
    const { container } = render(
      <SigningApprovalScreen
        origin="https://example.com"
        preview={{
          ...SIGN_MESSAGE_PREVIEW,
          kind: "batchSignDataItem",
          items: [
            {
              decodedData: MESSAGE,
              tags: [{ name: "Quan\u200btity", value: "\u2067100\u2069" }],
              target: null,
              payloadHash: SIGN_MESSAGE_PREVIEW.payloadHash,
            },
          ],
        }}
        onReject={vi.fn()}
        onSign={vi.fn()}
      />,
    );
    expect(HIDDEN.test(container.textContent!)).toBe(false);
    expect(container.textContent).toContain("Quan<U+200B>tity");
    expect(container.textContent).toContain("<U+2067>100<U+2069>");
  });

  it("shows hidden characters in a single item's tags", () => {
    const { container } = render(
      <SigningApprovalScreen
        origin="https://example.com"
        preview={{ ...SIGN_MESSAGE_PREVIEW, kind: "signDataItem", decodedData: "x", tags: [{ name: "Action", value: "Trans\u202efer" }] }}
        onReject={vi.fn()}
        onSign={vi.fn()}
      />,
    );
    expect(HIDDEN.test(container.textContent!)).toBe(false);
    expect(container.textContent).toContain("Trans<U+202E>fer");
  });
});
