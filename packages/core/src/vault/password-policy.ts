import { COMMON_PASSWORDS } from "./common-passwords";
import { userErrorMessage } from "../models/user-errors";

const MIN_LENGTH = 12;

const COMMON_PASSWORD_SET = new Set(
  COMMON_PASSWORDS.map((password) => password.toLowerCase()),
);

export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Password policy for vault encryption: minimum 12 characters, rejected
 * if it matches a common/breached password. Callers must run this
 * before `encryptToEnvelope` — the envelope layer itself does not
 * re-check policy, since re-encryption (e.g. re-deriving on unlock) must
 * never be blocked by a policy that only applies at password-set time.
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      reason: userErrorMessage("passwordTooShort", { min: MIN_LENGTH }),
    };
  }

  if (COMMON_PASSWORD_SET.has(password.toLowerCase())) {
    return {
      valid: false,
      reason: userErrorMessage("passwordTooCommon"),
    };
  }

  return { valid: true };
}
