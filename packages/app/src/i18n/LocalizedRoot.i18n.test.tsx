import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header";
import { setLanguagePreference } from "./index";
import { LocalizedRoot } from "./LocalizedRoot";

describe("LocalizedRoot", () => {
  afterEach(() => setLanguagePreference("system"));

  it("translates a shared component's default aria-label", () => {
    setLanguagePreference("zh-CN");
    render(
      <LocalizedRoot>
        <ScreenHeader title="x" onBack={() => {}} />
      </LocalizedRoot>,
    );
    expect(screen.getByRole("button", { name: "返回" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("zh-Hans");
  });

  it("keeps English without a language set", () => {
    render(
      <LocalizedRoot>
        <ScreenHeader title="x" onBack={() => {}} />
      </LocalizedRoot>,
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
