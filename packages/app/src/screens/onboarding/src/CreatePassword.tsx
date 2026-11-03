import { useState } from "react";
import {
  StepDots,
  PasswordField,
  PasswordStrengthMeter,
} from "@gleam/ui/src/components/onboarding/index.ts";
import { ScreenHeader } from "@gleam/ui/src/primitives/screen-header.tsx";
import { Button } from "@gleam/ui/src/primitives/button.tsx";
import { validatePassword } from "@gleam/core/src/vault/password-policy.ts";
import { ScreenFooter } from "@gleam/ui/src/primitives/screen-footer.tsx";
import { useT } from "../../../i18n";
import { errorText } from "../../../i18n/errors";

/**
 * Create wallet — password, reused for both the create and import flows.
 * Client-side `validatePassword` gives an inline message as the user
 * types; the same check runs again in the handler, since a UI-only check
 * is bypassable and never the actual enforcement point.
 */
export interface CreatePasswordProps {
  title?: string;
  onBack: () => void;
  onSubmit: (password: string) => void;
  submitting?: boolean;
  serverError?: string;
}

function strengthBars(password: string): number {
  if (password.length === 0) return 0;
  let score = 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 16) score += 1;
  if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export function CreatePassword({
  title,
  onBack,
  onSubmit,
  submitting = false,
  serverError,
}: CreatePasswordProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const validation = validatePassword(password);
  const confirmMismatch = touched && confirm.length > 0 && confirm !== password;

  const passwordError = touched && !validation.valid ? errorText(validation.reason) : serverError;
  const confirmError = confirmMismatch ? t("onboarding.passwordsMismatch") : undefined;

  const canSubmit = validation.valid && password === confirm && !submitting;

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        title={title ?? t("onboarding.createWallet")}
        onBack={onBack}
        busy={submitting}
        subtitle={<StepDots total={2} current={1} />}
      />
      <form
        className="flex flex-1 flex-col gap-5 px-6 phone:px-5 py-6 phone:pb-0"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (validation.valid && password === confirm) {
            onSubmit(password);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h3 font-semibold tracking-tight text-foreground">{t("onboarding.setPasswordTitle")}</h1>
          <p className="text-body leading-relaxed text-muted">
            {t("onboarding.setPasswordBody")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <PasswordField
            label={t("onboarding.passwordLabel")}
            placeholder={t("onboarding.newPasswordPlaceholder")}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched(true)}
            errorMessage={passwordError}
          />
          <PasswordStrengthMeter filled={strengthBars(password)} />
        </div>

        <PasswordField
          label={t("onboarding.confirmPasswordLabel")}
          placeholder={t("onboarding.confirmPasswordPlaceholder")}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          onBlur={() => setTouched(true)}
          errorMessage={confirmError}
        />

        <ScreenFooter className="mt-8">
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? t("onboarding.creating") : t("onboarding.continue")}
          </Button>
        </ScreenFooter>
      </form>
    </div>
  );
}
