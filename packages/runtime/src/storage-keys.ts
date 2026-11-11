/**
 * Storage keys more than one module reads or writes. A key is declared
 * once, so every `updateStored` of it queues on the same string
 * (`storage-keys.runtime.test.ts`).
 */
export const WALLETS_KEY = "local:wallets";
export const ACTIVE_WALLET_ID_KEY = "local:activeWalletId";
export const NETWORK_SETTINGS_KEY = "local:networkSettings";
export const CONTACTS_KEY = "local:contacts";
/** Per address. Written by `ReadsHandler` and `TransferHandler`, cleared with the wallet. */
export const ACTIVITY_LOG_KEY_PREFIX = "local:activityLog:";
/** Per address. */
export const WATCHED_PROCESS_IDS_KEY_PREFIX = "local:watchedProcessIds:";
