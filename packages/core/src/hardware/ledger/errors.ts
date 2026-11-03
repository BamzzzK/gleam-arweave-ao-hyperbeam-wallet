import { USER_ERRORS, userErrorMessage } from "../../models/user-errors";

export type LedgerErrorCode =
  | "device-locked"
  | "app-not-open"
  | "user-rejected"
  | "key-not-ready"
  | "data-invalid"
  | "conditions-not-satisfied"
  | "wrong-length"
  | "bad-data"
  | "device-error"
  | "permaweb-app-required"
  | "invalid-response"
  | "identity-mismatch"
  | "owner-mismatch"
  | "hash-mismatch"
  | "unsupported-payload"
  | "too-many-tags"
  | "unsupported-tags"
  | "signature-incomplete"
  | "signature-invalid"
  | "payload-too-large";

/** A Ledger failure whose `message` is copy the UI can show as is. */
export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  /** The device's status word, when the failure came from one. */
  readonly statusWord: number | undefined;

  constructor(code: LedgerErrorCode, message: string, statusWord?: number) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.statusWord = statusWord;
  }
}

export const SW_OK = 0x9000;

const STATUS_WORDS: Record<number, [LedgerErrorCode, string]> = {
  0x5515: ["device-locked", USER_ERRORS.ledgerLocked],
  0x6982: ["device-locked", USER_ERRORS.ledgerLocked],
  0x6d00: ["app-not-open", USER_ERRORS.ledgerAppClosed],
  0x6e00: ["app-not-open", USER_ERRORS.ledgerAppClosed],
  0x6e01: ["app-not-open", USER_ERRORS.ledgerAppClosed],
  0x6986: ["user-rejected", USER_ERRORS.ledgerRejected],
  0x6987: ["key-not-ready", USER_ERRORS.ledgerKeyNotReady],
  0x6984: ["data-invalid", USER_ERRORS.ledgerDataInvalid],
  0x6985: ["conditions-not-satisfied", USER_ERRORS.ledgerConditions],
  0x6700: ["wrong-length", USER_ERRORS.ledgerWrongLength],
  0x6a80: ["bad-data", USER_ERRORS.ledgerBadData],
};

function hex(statusWord: number): string {
  return `0x${statusWord.toString(16).padStart(4, "0")}`;
}

/** The printable ASCII the device app put before the status word, e.g. a parser error. */
function asciiReason(body: Uint8Array): string {
  let text = "";
  for (const byte of body) {
    if (byte >= 0x20 && byte <= 0x7e) text += String.fromCharCode(byte);
  }
  return text.trim();
}

/** Maps a non-0x9000 status word, and the response body it came with, to a `LedgerError`. */
export function statusWordError(statusWord: number, body: Uint8Array = new Uint8Array()): LedgerError {
  const known = STATUS_WORDS[statusWord];
  if (!known) {
    return new LedgerError("device-error", userErrorMessage("ledgerCommandFailed", { status: hex(statusWord) }), statusWord);
  }
  const [code, message] = known;
  if (statusWord === 0x6984) {
    const reason = asciiReason(body);
    if (reason) return new LedgerError(code, userErrorMessage("ledgerDataInvalidDetail", { detail: reason }), statusWord);
  }
  return new LedgerError(code, message, statusWord);
}
