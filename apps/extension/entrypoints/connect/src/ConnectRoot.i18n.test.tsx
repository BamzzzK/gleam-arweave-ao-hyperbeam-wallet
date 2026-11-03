import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimePort } from "@gleam/core";
import { setLanguagePreference } from "@gleam/app/src/i18n/index.tsx";
import { ConnectRoot } from "./ConnectRoot";

describe("ConnectRoot", () => {
  afterEach(() => setLanguagePreference("system"));

  it("mounts the page's language", () => {
    setLanguagePreference("zh-TW");
    const runtime = { send: () => new Promise(() => {}), onMessage: () => () => {} } as unknown as RuntimePort;
    render(<ConnectRoot device="ledger" runtime={runtime} />);
    expect(document.documentElement.lang).toBe("zh-Hant");
  });
});
