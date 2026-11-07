import { useEffect, useState } from "react";
import type { RuntimePort, ThemePreference, ThemeSettings } from "@gleam/core";
import { applyDocumentTheme, useSharedTheme } from "../../../theme";

/** The stored light/dark choice, changed at once on screen and put back if saving it fails. */
export function useTheme(runtime: RuntimePort) {
  const shared = useSharedTheme();
  const [local, setLocal] = useState<ThemePreference>("light");
  const [saving, setSaving] = useState(false);
  const theme = shared?.theme ?? local;

  useEffect(() => {
    if (shared) return;
    let cancelled = false;
    runtime
      .send<void, ThemeSettings>({ type: "getThemePreference", payload: undefined })
      .then((settings) => {
        if (!cancelled) setLocal(settings.theme);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [runtime, shared]);

  const show = (next: ThemePreference) => {
    if (shared) shared.setTheme(next);
    else setLocal(next);
    applyDocumentTheme(next);
  };

  const select = async (next: ThemePreference) => {
    if (next === theme) return;
    const previous = theme;
    show(next);
    setSaving(true);
    try {
      await runtime.send<ThemeSettings, void>({ type: "setThemePreference", payload: { theme: next } });
    } catch {
      show(previous);
    } finally {
      setSaving(false);
    }
  };

  return { theme, saving, select };
}
