import { afterEach, describe, expect, it } from "vitest";
import { releasePointerFocusOnBlur } from "./pointer-focus";

describe("releasePointerFocusOnBlur", () => {
  let stop = () => {};
  afterEach(() => {
    stop();
    document.body.replaceChildren();
  });

  function setup(tag: "button" | "input"): HTMLElement {
    const el = document.createElement(tag);
    document.body.append(el);
    stop = releasePointerFocusOnBlur(window);
    el.focus();
    return el;
  }

  it("drops a clicked button's focus when the window blurs", () => {
    const button = setup("button");
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("blur"));
    expect(document.activeElement).not.toBe(button);
  });

  it("keeps focus that came from the keyboard", () => {
    const button = setup("button");
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    window.dispatchEvent(new Event("blur"));
    expect(document.activeElement).toBe(button);
  });

  it("keeps a clicked text field focused", () => {
    const input = setup("input");
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("blur"));
    expect(document.activeElement).toBe(input);
  });
});
