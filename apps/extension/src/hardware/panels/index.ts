import type { DeviceSignPanels } from "@gleam/app/src/approval/device-panels.tsx";
import { LazyKeystonePanel } from "./LazyKeystonePanel";
import { LedgerPanel } from "./LedgerPanel";

export const DEVICE_SIGN_PANELS: DeviceSignPanels = {
  keystone: LazyKeystonePanel,
  ledger: LedgerPanel,
};
