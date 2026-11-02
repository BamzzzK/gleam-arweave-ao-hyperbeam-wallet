import React from "react";
import ReactDOM from "react-dom/client";
import "@gleam/app/src/app.css";
import { runtimePort } from "@/src/adapters/runtime";
import { useDocumentLanguage } from "@gleam/app/src/i18n/index.tsx";
import { ConnectView } from "./src/ConnectView";
import { LedgerConnectView } from "./src/LedgerConnectView";

const device = new URLSearchParams(window.location.search).get("device");

function ConnectRoot() {
  useDocumentLanguage();
  return device === "ledger" ? <LedgerConnectView runtime={runtimePort} /> : <ConnectView runtime={runtimePort} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConnectRoot />
  </React.StrictMode>,
);
