import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { OptionRow, OptionSection } from "@gleam/ui/src/primitives/option-list.tsx";
import { ExistingWalletOptions } from "./ExistingWallet";
import { useT } from "../../../i18n";

/**
 * Start of the add-wallet flow from the wallet switcher. Whoever lands
 * here already uses Gleam and chose to add a wallet, so every way in is
 * shown at once, grouped, without Welcome's new-or-existing step or its
 * brand hero.
 */
export interface AddWalletStartProps {
  onBack: () => void;
  onCreate: () => void;
  onImport: () => void;
  onConnectKeystone: () => void;
  onConnectLedger: () => void;
  onWatch: () => void;
}

export function AddWalletStart({ onBack, onCreate, ...existing }: AddWalletStartProps) {
  const t = useT();
  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("onboarding.addWallet")} onBack={onBack} />
      <div className="flex flex-1 flex-col gap-6 px-6 phone:px-5 py-6">
        <h1 className="text-h3 font-semibold tracking-tight text-foreground">{t("onboarding.addAWallet")}</h1>
        <OptionSection title={t("onboarding.sectionNew")}>
          <OptionRow
            title={t("onboarding.createWallet")}
            description={t("onboarding.createOptionHint")}
            onClick={onCreate}
          />
        </OptionSection>
        <ExistingWalletOptions {...existing} />
      </div>
    </div>
  );
}
