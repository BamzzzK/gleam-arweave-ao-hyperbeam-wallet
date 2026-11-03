import { useEffect, useState } from "react";
import type { RuntimePort, ThemeSettings } from "@gleam/core";
import { UnlockView } from "@gleam/app/src/screens/unlock/index.tsx";
import { PasskeySetup, type PasskeySetupProps } from "./PasskeySetup";
import { useT } from "@gleam/app/src/i18n/index.tsx";
import { LocalizedRoot } from "@gleam/app/src/i18n/LocalizedRoot.tsx";

export interface PasskeyRootProps {
  mode: "setup" | "unlock";
  runtime: RuntimePort;
  /** `true` reopens the Gleam popup before the window closes. */
  onFinish: (reopenPopup: boolean) => void;
  createPasskey?: PasskeySetupProps["createPasskey"];
}

/**
 * Root of the passkey window. Unlock reuses the popup's own unlock screen
 * with the prompt already started, so the password is still right there
 * if the passkey isn't to hand.
 */
export function PasskeyRoot(props: PasskeyRootProps) {
  return (
    <LocalizedRoot>
      <PasskeyContent {...props} />
    </LocalizedRoot>
  );
}

function PasskeyContent({ mode, runtime, onFinish, createPasskey }: PasskeyRootProps) {
  const t = useT();
  const [theme, setTheme] = useState<ThemeSettings["theme"]>("light");

  useEffect(() => {
    void (async () => {
      try {
        const settings = await runtime.send<void, ThemeSettings>({ type: "getThemePreference", payload: undefined });
        setTheme(settings?.theme === "dark" ? "dark" : "light");
      } catch {
        setTheme("light");
      }
    })();
  }, [runtime]);

  useEffect(() => {
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mode === "setup" ? (
        <PasskeySetup runtime={runtime} onDone={() => onFinish(false)} createPasskey={createPasskey} />
      ) : (
        <UnlockView
          runtime={runtime}
          tagline={t("extension.passkeyTagline")}
          autoStartPasskey
          onUnlocked={() => onFinish(true)}
          onResetComplete={() => onFinish(true)}
        />
      )}
    </div>
  );
}
