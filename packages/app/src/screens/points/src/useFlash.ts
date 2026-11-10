import { useEffect, useRef, useState } from "react";

export const FLASH_SHOWN_MS = 2000;
export const FLASH_FADE_MS = 700;

export type FlashPhase = "hidden" | "shown" | "fading";

/**
 * A note that appears on `flash()`, holds, then fades out before it
 * unmounts. `fading` lasts as long as the caller's opacity transition.
 */
export function useFlash(): { phase: FlashPhase; flash: () => void } {
  const [phase, setPhase] = useState<FlashPhase>("hidden");
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clear, []);

  return {
    phase,
    flash: () => {
      clear();
      setPhase("shown");
      timers.current = [
        window.setTimeout(() => setPhase("fading"), FLASH_SHOWN_MS),
        window.setTimeout(() => setPhase("hidden"), FLASH_SHOWN_MS + FLASH_FADE_MS),
      ];
    },
  };
}
