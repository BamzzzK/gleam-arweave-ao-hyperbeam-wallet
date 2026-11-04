import type { HeaderStyle, HeadlineBalance, RuntimePort, TokenRowDetail } from "@gleam/core";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { SelectRow, ToggleRow } from "@gleam/ui/src/primitives/setting-rows.tsx";
import { useDisplaySettings } from "../../../display-settings";
import { useT, type MessageKey } from "../../../i18n";

const HEADLINE_KEYS = [
  { value: "total", key: "homeScreen.headlineTotal" },
  { value: "AR", key: "homeScreen.headlineAr" },
  { value: "AO", key: "homeScreen.headlineAo" },
] as const satisfies readonly { value: HeadlineBalance; key: MessageKey }[];

const HEADER_KEYS = [
  { value: "full", key: "homeScreen.headerFull" },
  { value: "compact", key: "homeScreen.headerCompact" },
  { value: "minimal", key: "homeScreen.headerMinimal" },
] as const satisfies readonly { value: HeaderStyle; key: MessageKey }[];

const TOKEN_ROW_KEYS = [
  { value: "detailed", key: "homeScreen.tokenRowsDetailed" },
  { value: "simple", key: "homeScreen.tokenRowsSimple" },
] as const satisfies readonly { value: TokenRowDetail; key: MessageKey }[];

/**
 * How the home screen looks: which balance leads, how much header, how
 * much on each token row, and whether token logos show. Settings keeps
 * these a level down because most people set them once, if ever. Each
 * change saves as it's made.
 */
export interface HomeScreenViewProps {
  runtime: RuntimePort;
  onBack: () => void;
}

export function HomeScreenView({ runtime, onBack }: HomeScreenViewProps) {
  const t = useT();
  const { settings: display, update } = useDisplaySettings(runtime);
  const options = <T extends string>(keys: readonly { value: T; key: MessageKey }[]) =>
    keys.map((option) => ({ value: option.value, label: t(option.key) }));

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("homeScreen.title")} onBack={onBack} />
      <div className="flex flex-col px-6 phone:px-5 pb-6 pt-6 phone:pt-4">
        <SelectRow
          title={t("homeScreen.mainBalance")}
          value={display?.headline ?? "total"}
          options={options(HEADLINE_KEYS)}
          disabled={!display}
          onChange={(headline) => void update({ headline })}
        />
        <SelectRow
          title={t("homeScreen.header")}
          value={display?.header ?? "full"}
          options={options(HEADER_KEYS)}
          disabled={!display}
          onChange={(header) => void update({ header })}
        />
        <SelectRow
          title={t("homeScreen.tokenRows")}
          value={display?.tokenRows ?? "detailed"}
          options={options(TOKEN_ROW_KEYS)}
          disabled={!display}
          onChange={(tokenRows) => void update({ tokenRows })}
        />
        <ToggleRow
          title={t("homeScreen.tokenLogos")}
          checked={display?.tokenLogos ?? true}
          disabled={!display}
          onToggle={() => void update({ tokenLogos: !(display?.tokenLogos ?? true) })}
        />
      </div>
    </div>
  );
}
