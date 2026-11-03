import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KeyringLockedError } from "../signer/keyring";
import { capabilityRefusal, WATCH_ONLY_CONNECT_REFUSAL } from "./capabilities";
import { INVITE_REQUIRED_MESSAGE } from "./points";
import { matchUserError, USER_ERRORS, userErrorMessage, type UserErrorCode } from "./user-errors";

const sourceOf = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

function filled(code: UserErrorCode): string {
  const text: string = USER_ERRORS[code];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => `<${name}>`);
}

describe("matchUserError", () => {
  it.each(Object.keys(USER_ERRORS) as UserErrorCode[])("finds %s", (code) => {
    expect(matchUserError(filled(code))?.code).toBe(code);
  });

  it("returns the placeholder values", () => {
    expect(matchUserError(userErrorMessage("walletLocked", { wallet: "w1" }))).toEqual({
      code: "walletLocked",
      params: { wallet: "w1" },
    });
  });

  it("keeps a multi-line value whole", () => {
    expect(matchUserError(userErrorMessage("aoSubmitFailedDetail", { url: "u", status: 500, detail: "a\nb" }))?.params.detail).toBe("a\nb");
  });

  it("prefers a static template over a dynamic one", () => {
    expect(matchUserError("This wallet is watch-only, so it can't sign.")?.code).toBe("watchOnlySign");
    expect(matchUserError("That file isn't a valid Arweave keyfile.")?.code).toBe("keyfileInvalid");
  });

  it("prefers the narrower of two dynamic templates", () => {
    expect(matchUserError(userErrorMessage("aoSubmitFailedDetail", { url: "u", status: 500, detail: "busy" }))?.code).toBe("aoSubmitFailedDetail");
    expect(matchUserError(userErrorMessage("aoSubmitFailed", { url: "u", status: 500 }))?.code).toBe("aoSubmitFailed");
  });

  it("is anchored", () => {
    expect(matchUserError(`x ${USER_ERRORS.enterWebAddress}`)).toBeNull();
    expect(matchUserError(`${userErrorMessage("walletLocked", { wallet: "w" })} x`)).toBeNull();
    expect(matchUserError("Something else.")).toBeNull();
  });
});

describe("matchUserError on hostile text", () => {
  it("doesn't let a template's start and end overlap", () => {
    const template = USER_ERRORS.walletLocked;
    const [start] = template.split("{");
    expect(matchUserError(start!)).toBeNull();
  });

  it("stays fast on a long message that nearly matches every template", () => {
    const message = Object.values(USER_ERRORS).join(" ").repeat(200);
    const started = performance.now();
    matchUserError(message);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("userErrorMessage", () => {
  it("fills a value holding a replacement pattern as is", () => {
    expect(userErrorMessage("addressInGleam", { name: "$&" })).toBe('This address is already in Gleam as "$&".');
  });
});

describe("the exports built on the table", () => {
  it("keep their text", () => {
    expect(INVITE_REQUIRED_MESSAGE).toBe("An invite is required to join Gleam Points.");
    expect(WATCH_ONLY_CONNECT_REFUSAL).toBe(
      "The active Gleam wallet is watch-only, so it can't connect to sites. Switch to a wallet that can sign.",
    );
    expect(capabilityRefusal("watch", "signTransaction", "send collectibles")).toBe(
      "This wallet is watch-only, so it can't send collectibles.",
    );
    expect(capabilityRefusal("ethereum", "points", "join Gleam Points")).toBe(
      "This wallet can't join Gleam Points. Switch to a keyfile wallet.",
    );
  });
});

describe("texts repeated from signer/, which can't import the table", () => {
  it("match the keyring", () => {
    expect(new KeyringLockedError().message).toBe(USER_ERRORS.keyringLocked);
    expect(sourceOf("../signer/keyring.ts")).toContain(`"${USER_ERRORS.keyfileNoPrivateKey}"`);
  });

  it.each(["vaultUnreadableFormat", "vaultCorrupted", "vaultKdfFailed", "walletPasswordFailed"] as const)("match the envelope: %s", (code) => {
    expect(sourceOf("../signer/envelope.ts")).toContain(`"${USER_ERRORS[code]}"`);
  });
});
