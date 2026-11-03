import { createKeystonePanel } from "@gleam/keystone";
import type { DeviceSignPanels } from "@gleam/app/src/approval/device-panels.tsx";
import { cameraDeniedHelp } from "../keystone/camera-help";
import { LedgerPanel } from "./LedgerPanel";


export const DEVICE_SIGN_PANELS: DeviceSignPanels = {
  keystone: createKeystonePanel({ cameraDeniedHelp }),
  ledger: LedgerPanel,
};
