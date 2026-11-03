import { useCallback, useEffect, useId, useState } from "react";
import { usePlatform } from "../../../app-platform/context";
import type {
  AutoLockTimeout,
  HeaderStyle,
  HeadlineBalance,
  LockSettings,
  NetworkSettings,
  RuntimePort,
  ThemePreference,
  ThemeSettings,
  TokenRowDetail,
} from "@gleam/core";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { OptionRow, OptionSection } from "@gleam/ui/src/primitives/option-list.tsx";
import { useDisplaySettings } from "../../../display-settings";
import { REPO_URL } from "@gleam/core";
import { AboutBuild } from "./AboutBuild";
import { LANGUAGES, useLanguage, useT, type MessageKey } from "../../../i18n";

const TIMEOUT_KEYS = {
  never: "settingsHome.timeoutNever",
  immediate: "settingsHome.timeoutImmediate",
  "5min": "settingsHome.timeout5min",
  "1hr": "settingsHome.timeout1hr",
  "4hr": "settingsHome.timeout4hr",
} as const satisfies Record<AutoLockTimeout, MessageKey>;

const HEADLINE_KEYS = [
  { value: "total", key: "settingsHome.headlineTotal" },
  { value: "AR", key: "settingsHome.headlineAr" },
  { value: "AO", key: "settingsHome.headlineAo" },
] as const satisfies readonly { value: HeadlineBalance; key: MessageKey }[];

const HEADER_KEYS = [
  { value: "full", key: "settingsHome.headerFull" },
  { value: "compact", key: "settingsHome.headerCompact" },
  { value: "minimal", key: "settingsHome.headerMinimal" },
] as const satisfies readonly { value: HeaderStyle; key: MessageKey }[];

const TOKEN_ROW_KEYS = [
  { value: "detailed", key: "settingsHome.tokenRowsDetailed" },
  { value: "simple", key: "settingsHome.tokenRowsSimple" },
] as const satisfies readonly { value: TokenRowDetail; key: MessageKey }[];

function gatewayHostname(gatewayUrl: string): string {
  try {
    return new URL(gatewayUrl).hostname;
  } catch {
    return gatewayUrl;
  }
}

/**
 * The dedicated settings screen the gear icon opens: grouped
 * WALLET/NETWORK/DISPLAY sections of navigable rows, each showing
 * its current value on the right, with a Help & About section (feedback
 * card and source link) pinned below them.
 */
export interface SettingsHomeViewProps {
  runtime: RuntimePort;
  onBack: () => void;
  /** Omitted when the vault has no password, which hides the lock row. */
  onOpenLockSettings?: () => void;
  onOpenConnectedApps: () => void;
  onOpenNetworkPeers: () => void;
  onOpenManageTokens: () => void;
  onOpenContacts: () => void;
  onOpenDisplayCurrency: () => void;
  onOpenLanguage: () => void;
  onOpenFeedback: () => void;
}

interface LoadState {
  lockSettings: LockSettings | null;
  networkSettings: NetworkSettings | null;
  loading: boolean;
}

export function SettingsHomeView({
  runtime,
  onBack,
  onOpenLockSettings,
  onOpenConnectedApps,
  onOpenNetworkPeers,
  onOpenManageTokens,
  onOpenContacts,
  onOpenDisplayCurrency,
  onOpenLanguage,
  onOpenFeedback,
}: SettingsHomeViewProps) {
  const platform = usePlatform();
  const t = useT();
  const language = useLanguage();
  const { version } = platform.buildInfo;
  const [state, setState] = useState<LoadState>({ lockSettings: null, networkSettings: null, loading: true });
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [savingTheme, setSavingTheme] = useState(false);
  const { settings: display, update: updateDisplay } = useDisplaySettings(runtime);
  const headlineOptions = HEADLINE_KEYS.map((option) => ({ value: option.value, label: t(option.key) }));
  const headerOptions = HEADER_KEYS.map((option) => ({ value: option.value, label: t(option.key) }));
  const tokenRowOptions = TOKEN_ROW_KEYS.map((option) => ({ value: option.value, label: t(option.key) }));

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const [lockSettings, networkSettings, themeSettings] = await Promise.allSettled([
      runtime.send<void, LockSettings>({ type: "getLockSettings", payload: undefined }),
      runtime.send<void, NetworkSettings>({ type: "getNetworkSettings", payload: undefined }),
      runtime.send<void, ThemeSettings>({ type: "getThemePreference", payload: undefined }),
    ]);
    setState({
      lockSettings: lockSettings.status === "fulfilled" ? lockSettings.value : null,
      networkSettings: networkSettings.status === "fulfilled" ? networkSettings.value : null,
      loading: false,
    });
    if (themeSettings.status === "fulfilled") {
      setTheme(themeSettings.value.theme);
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleTheme = async () => {
    const next: ThemePreference = theme === "dark" ? "light" : "dark";
    const previous = theme;
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next === "dark" ? "dark" : "");
    if (next !== "dark") document.documentElement.removeAttribute("data-theme");
    setSavingTheme(true);
    try {
      await runtime.send<ThemeSettings, void>({ type: "setThemePreference", payload: { theme: next } });
    } catch {
      setTheme(previous);
      if (previous === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } finally {
      setSavingTheme(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title={t("settingsHome.title")} onBack={onBack} />

      <div className="flex flex-1 flex-col gap-8 phone:gap-6 px-6 phone:px-5 pb-6 pt-9 phone:pt-4">
        <OptionSection title={t("settingsHome.sectionWallet")}>
          {onOpenLockSettings ? (
            <OptionRow
              divided={false}
              title={t("settingsHome.lockTitle")}
              description={t("settingsHome.lockDescription")}
              value={state.loading ? undefined : state.lockSettings ? t(TIMEOUT_KEYS[state.lockSettings.autoLockTimeout]) : "—"}
              onClick={onOpenLockSettings}
            />
          ) : null}
          <OptionRow
            divided={false}
            title={t("settingsHome.connectedAppsTitle")}
            description={t("settingsHome.connectedAppsDescription")}
            onClick={onOpenConnectedApps}
          />
          <OptionRow
            divided={false}
            title={t("settingsHome.manageTokensTitle")}
            description={t("settingsHome.manageTokensDescription")}
            onClick={onOpenManageTokens}
          />
          <OptionRow
            divided={false}
            title={t("settingsHome.contactsTitle")}
            description={t("settingsHome.contactsDescription")}
            onClick={onOpenContacts}
          />
        </OptionSection>

        <OptionSection title={t("settingsHome.sectionDisplay")}>
          <OptionRow
            divided={false}
            title={t("settingsHome.currencyTitle")}
            description={t("settingsHome.currencyDescription")}
            value={display?.currency}
            onClick={onOpenDisplayCurrency}
          />
          <OptionRow
            divided={false}
            title={t("language.title")}
            description={t("language.description")}
            value={LANGUAGES.find((entry) => entry.code === language)?.name}
            onClick={onOpenLanguage}
          />
          <SelectRow
            title={t("settingsHome.mainBalance")}
            value={display?.headline ?? "total"}
            options={headlineOptions}
            disabled={!display}
            onChange={(headline) => void updateDisplay({ headline })}
          />
          <SelectRow
            title={t("settingsHome.header")}
            value={display?.header ?? "full"}
            options={headerOptions}
            disabled={!display}
            onChange={(header) => void updateDisplay({ header })}
          />
          <SelectRow
            title={t("settingsHome.tokenRows")}
            value={display?.tokenRows ?? "detailed"}
            options={tokenRowOptions}
            disabled={!display}
            onChange={(tokenRows) => void updateDisplay({ tokenRows })}
          />
          <ToggleRow
            title={t("settingsHome.tokenLogos")}
            checked={display?.tokenLogos ?? true}
            disabled={!display}
            onToggle={() => void updateDisplay({ tokenLogos: !(display?.tokenLogos ?? true) })}
          />
          <ToggleRow
            title={t("settingsHome.darkMode")}
            checked={theme === "dark"}
            disabled={savingTheme}
            onToggle={() => void handleToggleTheme()}
          />
        </OptionSection>

        <OptionSection title={t("settingsHome.sectionNetwork")}>
          <OptionRow
            divided={false}
            title={t("settingsHome.networkTitle")}
            description={t("settingsHome.networkDescription")}
            value={
              state.loading ? undefined : state.networkSettings ? gatewayHostname(state.networkSettings.gatewayUrl) : "—"
            }
            onClick={onOpenNetworkPeers}
          />
        </OptionSection>

        <div className="mt-auto">
          <OptionSection title={t("settingsHome.sectionHelp")}>
            <FeedbackCard onClick={onOpenFeedback} />
            <SourceLink />
            <AboutBuild runtime={runtime} version={version} />
          </OptionSection>
        </div>
      </div>
    </div>
  );
}

function SelectRow<T extends string>({
  title,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  value: T;
  options: { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex w-full items-center justify-between gap-3 py-3.5">
      <label htmlFor={id} className="text-label font-semibold text-foreground">
        {title}
      </label>
      {/* The native arrow ignores padding, so it's hidden and drawn here with room on the right. */}
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as T)}
          className="appearance-none rounded-md border border-line bg-background py-1.5 pl-2.5 pr-8 text-label text-foreground focus:outline-none focus-visible:border-foreground disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  checked,
  disabled,
  onToggle,
}: {
  title: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center justify-between py-3.5 text-left disabled:opacity-60"
    >
      <span className="text-label font-semibold text-foreground">{title}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-foreground" : "bg-line"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

/** The geometry every Help & About row shares with `OptionRow`: no horizontal inset, a 20px leading icon box, the trailing icon on the right edge. */
const HELP_ROW =
  "flex w-full items-center gap-2.5 py-3.5 text-left hover:bg-mist phone:min-h-[3.75rem] phone:py-2.5 phone:active:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground";

function LeadingIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center ${className ?? "text-foreground"}`}>
      {children}
    </span>
  );
}

/** It leaves the wallet for the website's feedback form, so the trailing icon marks it as a link out. */
function FeedbackCard({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} className={HELP_ROW}>
      <LeadingIcon>
        <FeedbackIcon />
      </LeadingIcon>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label font-semibold text-foreground">{t("settingsHome.feedbackTitle")}</span>
        <span className="text-caption text-muted">{t("settingsHome.feedbackDescription")}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-faint">
        <ExternalIcon />
      </span>
    </button>
  );
}

/** A wallet asks for trust, so the source sits one click away. */
function SourceLink() {
  const t = useT();
  return (
    <a href={REPO_URL} target="_blank" rel="noreferrer" className={HELP_ROW}>
      <LeadingIcon>
        <GitHubIcon />
      </LeadingIcon>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label font-semibold text-foreground">{t("settingsHome.sourceTitle")}</span>
        <span className="text-caption text-muted">{t("settingsHome.sourceDescription")}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-faint">
        <ExternalIcon />
      </span>
    </a>
  );
}

function FeedbackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
