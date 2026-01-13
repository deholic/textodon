import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MastodonHttpClient } from "./infra/MastodonHttpClient";
import { MastodonStreamingClient } from "./infra/MastodonStreamingClient";
import { MastodonOAuthClient } from "./infra/MastodonOAuthClient";
import { MisskeyHttpClient } from "./infra/MisskeyHttpClient";
import { MisskeyOAuthClient } from "./infra/MisskeyOAuthClient";
import { MisskeyStreamingClient } from "./infra/MisskeyStreamingClient";
import { LocalStorageAccountStore } from "./infra/LocalStorageAccountStore";
import { UnifiedApiClient } from "./infra/UnifiedApiClient";
import { UnifiedOAuthClient } from "./infra/UnifiedOAuthClient";
import { UnifiedStreamingClient } from "./infra/UnifiedStreamingClient";
import { AppProvider } from "./ui/state/AppContext";
import { ToastProvider } from "./ui/state/ToastContext";
import "./ui/styles/main.css";

const mastodonApi = new MastodonHttpClient();
const misskeyApi = new MisskeyHttpClient();
const mastodonStreaming = new MastodonStreamingClient();
const misskeyStreaming = new MisskeyStreamingClient();
const mastodonOAuth = new MastodonOAuthClient();
const misskeyOAuth = new MisskeyOAuthClient();

const services = {
  api: new UnifiedApiClient(mastodonApi, misskeyApi),
  streaming: new UnifiedStreamingClient(mastodonStreaming, misskeyStreaming),
  accountStore: new LocalStorageAccountStore(),
  oauth: new UnifiedOAuthClient(mastodonOAuth, misskeyOAuth)
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <AppProvider services={services}>
        <App />
      </AppProvider>
    </ToastProvider>
  </React.StrictMode>
);
