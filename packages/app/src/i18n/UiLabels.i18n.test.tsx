import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header";
import { setLanguagePreference } from "./index";
import { UiLabels } from "./UiLabels";

describe("UiLabels", () => {
  afterEach(() => setLanguagePreference("system"));

  it("translates a shared component's default aria-label", () => {
    setLanguagePreference("zh-CN");
    render(
      <UiLabels>
        <ScreenHeader title="x" onBack={() => {}} />
      </UiLabels>,
    );
    expect(screen.getByRole("button", { name: "返回" })).toBeTruthy();
  });

  it("keeps English without a language set", () => {
    render(
      <UiLabels>
        <ScreenHeader title="x" onBack={() => {}} />
      </UiLabels>,
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
