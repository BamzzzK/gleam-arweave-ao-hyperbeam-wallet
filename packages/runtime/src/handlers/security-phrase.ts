import { readSecurityPhrase, type SecurityPhrase, type StoragePort } from "@gleam/core";
import { userErrorMessage } from "@gleam/core/src/models/user-errors.ts";

const SECURITY_PHRASE_KEY = "local:securityPhrase";

/**
 * The anti-phishing phrase. It lives in plain `local` storage because the
 * unlock screen shows it before any password is typed; web pages can't
 * read extension storage, which is the whole point. It survives a vault
 * reset, like the theme.
 */
export class SecurityPhraseHandler {
  constructor(private readonly storage: StoragePort) {}

  async get(): Promise<SecurityPhrase | null> {
    return readSecurityPhrase(await this.storage.get<unknown>(SECURITY_PHRASE_KEY));
  }

  async set(req: SecurityPhrase): Promise<void> {
    const phrase = readSecurityPhrase(req);
    if (!phrase) throw new Error(userErrorMessage("securityPhraseInvalid"));
    // eslint-disable-next-line gleam/no-storage-read-modify-write -- the new phrase replaces the old one
    await this.storage.set(SECURITY_PHRASE_KEY, phrase);
  }
}
