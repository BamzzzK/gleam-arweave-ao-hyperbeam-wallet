import { createKeystonePanel } from "@gleam/keystone/src/KeystonePanel.tsx";
import { cameraDeniedHelp } from "../keystone/camera-help";

/** Loaded only through `LazyKeystonePanel`'s `import()`. */
export const KeystonePanel = createKeystonePanel({ cameraDeniedHelp });
