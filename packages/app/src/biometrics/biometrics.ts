import type { RuntimePort } from "@gleam/core";
import type { BiometricUnlockPort, BiometryKind } from "../app-platform/types";
import { t, type MessageKey } from "../i18n";
import { errorText } from "../i18n/errors";

/**
 * - `invalidated`: the device's biometrics changed, so the OS discarded the
 *   stored password.
 * - `mismatch`: the stored password no longer opens the vault.
 */
export type BiometricErrorReason =
  | "cancelled"
  | "failed"
  | "lockout"
  | "invalidated"
  | "mismatch"
  | "unavailable"
  | "unknown";

export class BiometricError extends Error {
  constructor(
    readonly reason: BiometricErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "BiometricError";
  }
}

const LABEL_KEYS: Record<BiometryKind, MessageKey> = {
  faceId: "app.biometryFaceId",
  touchId: "app.biometryTouchId",
  fingerprint: "app.biometryFingerprint",
  face: "app.biometryFace",
  iris: "app.biometryIris",
  biometrics: "app.biometryGeneric",
};

/** The name to use mid-sentence: "Unlock with Face ID", "Unlock with fingerprint". */
export function biometryLabel(kind: BiometryKind): string {
  return t(LABEL_KEYS[kind]);
}

/** The name to start a heading or sentence with. */
export function biometryTitle(kind: BiometryKind): string {
  const label = biometryLabel(kind);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Asks the OS for the stored password, then unlocks with it as the
 * password form does.
 */
export async function unlockWithBiometrics(
  runtime: RuntimePort,
  biometrics: BiometricUnlockPort,
  kind: BiometryKind,
): Promise<{ unlockedWalletIds: string[] }> {
  const password = await biometrics.readPassword();
  try {
    return await runtime.send<{ password: string }, { unlockedWalletIds: string[] }>({
      type: "unlockWallet",
      payload: { password },
    });
  } catch (error) {
    // Only a definite "doesn't open" drops the stored password. A check
    // that couldn't run says nothing about it, so the unlock error stands.
    const probe = await runtime
      .send<{ password: string }, { opens: boolean }>({ type: "probeVaultPassword", payload: { password } })
      .catch(() => null);
    if (probe?.opens !== false) throw error;
    // Every wallet the stored password protected was removed and a new
    // password set. Keeping it would fail the same way on every unlock.
    await biometrics.remove().catch(() => {});
    throw new BiometricError(
      "mismatch",
      t("app.biometricMismatch", { title: biometryTitle(kind), label: biometryLabel(kind) }),
    );
  }
}

/** Errors that leave nothing stored, so the biometric option goes away. */
export function biometricsGone(error: unknown): boolean {
  return error instanceof BiometricError && (error.reason === "invalidated" || error.reason === "mismatch");
}

export function biometricNotice(error: unknown, kind: BiometryKind): { text: string; tone: "muted" | "error" } {
  const label = biometryLabel(kind);
  const title = biometryTitle(kind);
  if (!(error instanceof BiometricError)) {
    return { text: errorText(error), tone: "error" };
  }
  switch (error.reason) {
    case "cancelled":
      return { text: t("app.biometricCancelled", { title }), tone: "muted" };
    case "failed":
      return { text: t("app.biometricFailed", { title }), tone: "error" };
    case "lockout":
      return { text: t("app.biometricLockout"), tone: "error" };
    case "invalidated":
      return {
        text: t("app.biometricInvalidated", { label }),
        tone: "error",
      };
    case "unavailable":
      return { text: t("app.biometricUnavailable", { title }), tone: "error" };
    default:
      return { text: error.message, tone: "error" };
  }
}
