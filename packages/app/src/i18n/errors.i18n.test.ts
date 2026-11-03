import { afterEach, describe, expect, it } from "vitest";
import { capabilityRefusal, USER_ERRORS, userErrorMessage, type UserErrorCode } from "@gleam/core";
import { CATALOGS } from "./catalog";
import { errorText, userErrorKey } from "./errors";
import { setLanguagePreference } from "./index";

afterEach(() => setLanguagePreference("system"));

const CODES = Object.keys(USER_ERRORS) as UserErrorCode[];

function samples(code: UserErrorCode): Record<string, string> {
  const template: string = USER_ERRORS[code];
  return Object.fromEntries([...template.matchAll(/\{(\w+)\}/g)].map((m) => [m[1]!, `<${m[1]}>`]));
}

describe("userErrorKey", () => {
  it.each(CODES)("%s reads the same in the English catalog", (code) => {
    expect(CATALOGS.en[userErrorKey(code)]).toBe(USER_ERRORS[code]);
  });
});

describe("errorText", () => {
  it.each(CODES)("%s comes back unchanged in English", (code) => {
    const text = (userErrorMessage as (c: string, p: unknown) => string)(code, samples(code));
    // `samples` isn't a value `action`, `field` or `reason` can take, so those stay as they came.
    expect(errorText(new Error(text))).toBe(text);
  });

  it("translates an error and fills its placeholders", () => {
    setLanguagePreference("zh-CN");
    expect(errorText(new Error(userErrorMessage("walletLocked", { wallet: "w1" })))).toBe("钱包“w1”已锁定。请解锁后继续。");
    setLanguagePreference("zh-TW");
    expect(errorText(new Error(userErrorMessage("walletLocked", { wallet: "w1" })))).toBe("錢包「w1」已鎖定。請解鎖後繼續。");
  });

  it("translates a refusal handed over as a string", () => {
    setLanguagePreference("zh-CN");
    expect(errorText(USER_ERRORS.enterWebAddress)).toBe("请输入网址。");
  });

  it("leaves an unknown error in English", () => {
    setLanguagePreference("zh-CN");
    expect(errorText(new Error("Boom."))).toBe("Boom.");
    expect(errorText("Boom.")).toBe("Boom.");
  });

  it("translates the action inside a refusal", () => {
    setLanguagePreference("zh-CN");
    expect(errorText(capabilityRefusal("watch", "signTransaction", "send collectibles"))).toBe("此钱包为仅观察钱包，无法发送收藏品。");
    expect(errorText(capabilityRefusal("watch", "signDataItem", "send wAR"))).toBe("此钱包为仅观察钱包，无法发送 wAR。");
    expect(errorText(capabilityRefusal("ethereum", "points", "join Gleam Points"))).toBe("此钱包无法加入 Gleam Points。请切换到密钥文件钱包。");
  });

  it("keeps a whole sentence in English when a part of it has no translation", () => {
    setLanguagePreference("zh-CN");
    const unknownAction = capabilityRefusal("watch", "points", "do something new")!;
    expect(errorText(unknownAction)).toBe(unknownAction);
    const serverReason = userErrorMessage("pointsJoinFailed", { reason: "Malformed request." });
    expect(errorText(serverReason)).toBe(serverReason);
  });

  it("translates the points server's refusals and its HTTP fallback", () => {
    setLanguagePreference("zh-TW");
    expect(errorText(userErrorMessage("pointsLeaveFailed", { reason: "Too many requests." }))).toBe("無法退出 Gleam Points：要求過多。");
    expect(errorText(userErrorMessage("pointsJoinFailed", { reason: "HTTP 503" }))).toBe("無法加入 Gleam Points：HTTP 503");
  });

  it("translates the failure notes in a balance error", () => {
    setLanguagePreference("zh-CN");
    const message = userErrorMessage("tokenBalanceUnreadable", { label: "token", failures: "a.io (timed out), b.io (unreadable answer), c.io (HTTP 500)" });
    expect(errorText(message)).toBe(
      "无法读取你的 代币 余额。已尝试 a.io (超时), b.io (无法读取的响应), c.io (HTTP 500)。该代币的节点可能正忙，请一分钟后重试。",
    );
  });

  it("leaves a ticker as it is", () => {
    setLanguagePreference("zh-CN");
    const message = userErrorMessage("tokenBalanceUnreadable", { label: "AO", failures: "a.io (HTTP 500)" });
    expect(errorText(message)).toContain("无法读取你的 AO 余额");
  });
});
