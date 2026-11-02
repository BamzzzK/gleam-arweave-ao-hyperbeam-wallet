import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { OptionSection } from "@gleam/ui/src/primitives/option-list.tsx";
import { LANGUAGES, setLanguagePreference, useLanguagePreference, useT, type LanguagePreference } from "../../../i18n";

/** Picks the language the wallet is shown in; the choice applies at once and stays on this device. */
export interface LanguageViewProps {
  onBack: () => void;
}

export function LanguageView({ onBack }: LanguageViewProps) {
  const t = useT();
  const preference = useLanguagePreference();

  const renderOption = (value: LanguagePreference, label: string, hint?: string) => {
    const selected = preference === value;
    return (
      <button
        key={value}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => setLanguagePreference(value)}
        className="flex w-full items-center gap-3 py-3 text-left phone:py-3.5 hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-label font-semibold text-foreground">{label}</span>
          {hint ? <span className="block text-caption text-muted">{hint}</span> : null}
        </span>
        <span aria-hidden="true" className="w-4 flex-shrink-0 text-foreground">
          {selected ? <CheckIcon /> : null}
        </span>
      </button>
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("language.title")} onBack={onBack} />
      <div className="flex flex-1 flex-col gap-6 px-6 phone:px-5 pb-6 pt-5">
        <div role="radiogroup" aria-label={t("language.title")}>
          <OptionSection title={t("language.title")}>
            {renderOption("system", t("language.system"), t("language.systemHint"))}
            {LANGUAGES.map((language) => renderOption(language.code, language.name))}
          </OptionSection>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
