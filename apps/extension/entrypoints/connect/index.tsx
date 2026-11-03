import React from "react";
import ReactDOM from "react-dom/client";
import "@gleam/app/src/app.css";
import { runtimePort } from "@/src/adapters/runtime";
import { ConnectRoot } from "./src/ConnectRoot";

const device = new URLSearchParams(window.location.search).get("device");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConnectRoot device={device} runtime={runtimePort} />
  </React.StrictMode>,
);
