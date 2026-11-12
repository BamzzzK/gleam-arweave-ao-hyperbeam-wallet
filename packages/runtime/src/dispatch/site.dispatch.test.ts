import { describe, expect, it, vi } from "vitest";
import { SITE_ORIGIN } from "@gleam/core/src/models/site-origin.ts";
import { dispatchSiteMessage, isSiteOrigin, UNKNOWN_SITE_MESSAGE, type SiteHandlers } from "./site";
import type { CallerContext } from "@gleam/messaging/src/caller.ts";

describe("isSiteOrigin", () => {
  const LOCAL = ["http://localhost:8000", "http://localhost", "http://127.0.0.1:5173"];

  it("accepts the site in every build", () => {
    expect(isSiteOrigin(SITE_ORIGIN, false)).toBe(true);
    expect(isSiteOrigin(SITE_ORIGIN, true)).toBe(true);
  });

  it.each(LOCAL)("refuses %s in a production build", (origin) => {
    expect(isSiteOrigin(origin, false)).toBe(false);
  });

  it.each(LOCAL)("accepts %s in a development build", (origin) => {
    expect(isSiteOrigin(origin, true)).toBe(true);
  });

  it.each([
    "https://localhost:8000",
    "http://foo.localhost:8000",
    "http://localhost.evil.example",
    "http://192.168.1.10:8000",
    "http://[::1]:8000",
    "http://localhost:8000/attest.html",
    "null",
    "",
    undefined,
  ])("refuses %s even in a development build", (origin) => {
    expect(isSiteOrigin(origin, true)).toBe(false);
  });
});

describe("dispatchSiteMessage", () => {
  const STATUS = { type: "gleam-points:attest-status" };

  function handlers() {
    const status = vi.fn(async () => "handled");
    const unused = vi.fn(async () => "unused");
    const all: SiteHandlers = { "gleam-points:invite": unused, "gleam-points:attest": unused, "gleam-points:attest-status": status };
    return { all, status, unused };
  }

  it("hands a site caller on the site's origin to the handler", async () => {
    const { all, status } = handlers();
    expect(await dispatchSiteMessage(STATUS, { tier: "site", origin: SITE_ORIGIN }, all, false)).toBe("handled");
    expect(status).toHaveBeenCalledOnce();
  });

  it.each<[string, CallerContext | null]>([
    ["no caller", null],
    ["an extension page", { tier: "extension" }],
    ["a content script on the site's origin", { tier: "contentScript", origin: SITE_ORIGIN, tabId: 1 }],
    ["a site caller on another origin", { tier: "site", origin: "https://evil.example" }],
    ["a site caller on localhost in a production build", { tier: "site", origin: "http://localhost:8000" }],
  ])("refuses %s without running a handler", async (_label, caller) => {
    const { all, status } = handlers();
    expect(await dispatchSiteMessage(STATUS, caller, all, false)).toEqual({ ok: false });
    expect(status).not.toHaveBeenCalled();
  });

  it("refuses a message that doesn't match its schema, even from the site", async () => {
    const { all, status } = handlers();
    const caller: CallerContext = { tier: "site", origin: SITE_ORIGIN };
    expect(await dispatchSiteMessage({ ...STATUS, extra: 1 }, caller, all, false)).toEqual({ ok: false });
    expect(status).not.toHaveBeenCalled();
  });

  it("answers an unknown type before looking at the caller", async () => {
    const { all } = handlers();
    expect(await dispatchSiteMessage({ type: "nope" }, null, all, false)).toBe(UNKNOWN_SITE_MESSAGE);
    expect(await dispatchSiteMessage("gleam-points:invite", null, all, false)).toBe(UNKNOWN_SITE_MESSAGE);
    expect(await dispatchSiteMessage({ type: "toString" }, null, all, false)).toBe(UNKNOWN_SITE_MESSAGE);
  });
});
