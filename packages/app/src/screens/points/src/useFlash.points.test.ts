import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_FADE_MS, FLASH_SHOWN_MS, useFlash } from "./useFlash";

describe("useFlash", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows, fades, then hides", () => {
    const { result } = renderHook(() => useFlash());
    expect(result.current.phase).toBe("hidden");

    act(() => result.current.flash());
    expect(result.current.phase).toBe("shown");

    act(() => vi.advanceTimersByTime(FLASH_SHOWN_MS));
    expect(result.current.phase).toBe("fading");

    act(() => vi.advanceTimersByTime(FLASH_FADE_MS));
    expect(result.current.phase).toBe("hidden");
  });

  it("restarts the hold when flashed again", () => {
    const { result } = renderHook(() => useFlash());
    act(() => result.current.flash());
    act(() => vi.advanceTimersByTime(FLASH_SHOWN_MS - 100));
    act(() => result.current.flash());
    act(() => vi.advanceTimersByTime(FLASH_SHOWN_MS - 100));
    expect(result.current.phase).toBe("shown");
  });
});
