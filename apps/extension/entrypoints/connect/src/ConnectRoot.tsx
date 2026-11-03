import type { RuntimePort } from "@gleam/core";
import { LocalizedRoot } from "@gleam/app/src/i18n/LocalizedRoot.tsx";
import { ConnectView } from "./ConnectView";
import { LedgerConnectView } from "./LedgerConnectView";

export function ConnectRoot({ device, runtime }: { device: string | null; runtime: RuntimePort }) {
  return <LocalizedRoot>{device === "ledger" ? <LedgerConnectView runtime={runtime} /> : <ConnectView runtime={runtime} />}</LocalizedRoot>;
}
