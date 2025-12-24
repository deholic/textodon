import type { RegisteredApp } from "../../services/OAuthClient";

const STORAGE_KEY = "textodon.oauth.pending";

export type OAuthPending = RegisteredApp & { state: string };

const APPS_STORAGE_KEY = "textodon.oauth.apps";

export const createOauthState = (): string => crypto.randomUUID();

export const storePendingOAuth = (pending: OAuthPending) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
};

export const loadPendingOAuth = (): OAuthPending | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as OAuthPending;
  } catch {
    return null;
  }
};

export const clearPendingOAuth = () => {
  sessionStorage.removeItem(STORAGE_KEY);
};

const loadAppMap = (): Record<string, RegisteredApp> => {
  try {
    const raw = sessionStorage.getItem(APPS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, RegisteredApp>;
  } catch {
    return {};
  }
};

const saveAppMap = (map: Record<string, RegisteredApp>) => {
  sessionStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(map));
};

export const loadRegisteredApp = (instanceUrl: string): RegisteredApp | null => {
  const map = loadAppMap();
  return map[instanceUrl] ?? null;
};

export const saveRegisteredApp = (app: RegisteredApp) => {
  const map = loadAppMap();
  map[app.instanceUrl] = app;
  saveAppMap(map);
};
