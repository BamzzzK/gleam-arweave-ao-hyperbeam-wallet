import type { RuntimePort } from "@gleam/core";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { OptionRow } from "@gleam/ui/src/primitives/option-list.tsx";
import { useDisplaySettings } from "../../../display-settings";
import { LANGUAGES, useLanguage, useT } from "../../../i18n";

export interface AppearanceViewProps {
  runtime: RuntimePort;
  onBack: () => void;
  onOpenDisplayCurrency: () => void;
  onOpenLanguage: () => void;
  onOpenHomeScreen: () => void;
}

/** How Gleam looks and reads: currency, language and the home screen's layout. The theme toggle is on the settings screen. */
export function AppearanceView({ runtime, onBack, onOpenDisplayCurrency, onOpenLanguage, onOpenHomeScreen }: AppearanceViewProps) {
  const t = useT();
  const language = useLanguage();
  const { settings: display } = useDisplaySettings(runtime);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("settingsHome.appearance")} onBack={onBack} />
      <div className="flex flex-col px-6 pb-6 pt-6 phone:px-5 phone:pt-4">
        <OptionRow title={t("settingsHome.currencyTitle")} value={display?.currency} onClick={onOpenDisplayCurrency} />
        <OptionRow
          title={t("language.title")}
          value={LANGUAGES.find((entry) => entry.code === language)?.name}
          onClick={onOpenLanguage}
        />
        <OptionRow title={t("homeScreen.title")} onClick={onOpenHomeScreen} />
      </div>
    </div>
  );
}
