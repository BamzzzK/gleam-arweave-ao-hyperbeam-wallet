import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { OptionRow, OptionSection } from "@gleam/ui/src/primitives/option-list.tsx";
import { usePlatform } from "../../../app-platform/context";
import { hasHardwareWallet } from "../../../app-platform/hardware";
import { useT } from "../../../i18n";

/**
 * The ways to bring in a wallet the user already has, grouped by what
 * they need on hand. Shown after Welcome's "I already have a wallet", and
 * as part of `AddWalletStart`.
 */
export interface ExistingWalletOptionsProps {
  onImport: () => void;
  onConnectKeystone: () => void;
  onConnectLedger: () => void;
  onWatch: () => void;
}

export function ExistingWalletOptions({ onImport, onConnectKeystone, onConnectLedger, onWatch }: ExistingWalletOptionsProps) {
  const t = useT();
  const { capabilities } = usePlatform();
  const { ledger, keystone } = capabilities.hardwareWallets;
  return (
    <>
      <OptionSection title={t("onboarding.fromFile")}>
        <OptionRow title={t("onboarding.importKeyfile")} description={t("onboarding.importKeyfileHint")} onClick={onImport} />
      </OptionSection>
      {hasHardwareWallet(capabilities) ? (
        <OptionSection title={t("onboarding.hardwareWallet")}>
          {ledger ? <OptionRow title="Ledger" description={t("onboarding.ledgerHint")} onClick={onConnectLedger} /> : null}
          {keystone ? (
            <OptionRow title="Keystone" description={t("onboarding.keystoneHint")} onClick={onConnectKeystone} />
          ) : null}
        </OptionSection>
      ) : null}
      <OptionSection title={t("onboarding.addressOnly")}>
        <OptionRow title={t("onboarding.watchAddress")} description={t("onboarding.watchOptionHint")} onClick={onWatch} />
      </OptionSection>
    </>
  );
}

export interface ExistingWalletProps extends ExistingWalletOptionsProps {
  onBack: () => void;
}

export function ExistingWallet({ onBack, ...options }: ExistingWalletProps) {
  const t = useT();
  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("onboarding.useExistingWallet")} onBack={onBack} />
      <div className="flex flex-1 flex-col gap-6 px-6 phone:px-5 py-6">
        <ExistingWalletOptions {...options} />
      </div>
    </div>
  );
}
