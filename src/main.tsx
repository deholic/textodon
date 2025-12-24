import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MastodonHttpClient } from "./infra/MastodonHttpClient";
import { MastodonStreamingClient } from "./infra/MastodonStreamingClient";
import { MastodonOAuthClient } from "./infra/MastodonOAuthClient";
import { SessionStorageAccountStore } from "./infra/SessionStorageAccountStore";
import { AppProvider } from "./ui/state/AppContext";
import "./ui/styles/main.css";

const services = {
  api: new MastodonHttpClient(),
  streaming: new MastodonStreamingClient(),
  accountStore: new SessionStorageAccountStore(),
  oauth: new MastodonOAuthClient()
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider services={services}>
      <App />
    </AppProvider>
  </React.StrictMode>
);
