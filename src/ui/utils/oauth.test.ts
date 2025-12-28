import { beforeEach, describe, expect, it } from "bun:test";
import type { RegisteredApp } from "../../services/OAuthClient";
import {
  clearPendingOAuth,
  loadPendingOAuth,
  loadRegisteredApp,
  saveRegisteredApp,
  storePendingOAuth
} from "./oauth";

type StorageValue = string | null;

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem(key: string): StorageValue {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
};

describe("oauth utils", () => {
  const memoryStorage = createMemoryStorage();

  beforeEach(() => {
    memoryStorage.clear();
    globalThis.sessionStorage = memoryStorage as Storage;
  });

  it("stores and clears pending OAuth state", () => {
    const pending = {
      platform: "mastodon",
      instanceUrl: "https://social.example",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://app.example/callback",
      scope: "read",
      state: "state"
    };

    storePendingOAuth(pending);
    expect(loadPendingOAuth()).toEqual(pending);

    clearPendingOAuth();
    expect(loadPendingOAuth()).toBeNull();
  });

  it("saves and loads registered apps by instance URL", () => {
    const app: RegisteredApp = {
      platform: "misskey",
      instanceUrl: "https://mk.example",
      redirectUri: "https://app.example/callback",
      scope: "read",
      sessionId: "session",
      appName: "Textodon"
    };

    saveRegisteredApp(app);

    expect(loadRegisteredApp("https://mk.example")).toEqual(app);
    expect(loadRegisteredApp("https://missing.example")).toBeNull();
  });
});
