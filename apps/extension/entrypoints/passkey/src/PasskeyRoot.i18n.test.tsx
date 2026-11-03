import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimePort } from "@gleam/core";
import { setLanguagePreference } from "@gleam/app/src/i18n/index.tsx";
import { PasskeyRoot } from "./PasskeyRoot";

describe("PasskeyRoot", () => {
  afterEach(() => setLanguagePreference("system"));

  it("translates the shared components in the setup window", () => {
    setLanguagePreference("zh-CN");
    const runtime = { send: () => new Promise(() => {}), onMessage: () => () => {} } as unknown as RuntimePort;
    render(<PasskeyRoot mode="setup" runtime={runtime} onFinish={() => {}} />);
    expect(screen.getByRole("button", { name: "显示密码" })).toBeTruthy();
  });
});
