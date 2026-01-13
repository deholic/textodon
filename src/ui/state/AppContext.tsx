import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Account, CustomEmoji } from "../../domain/types";
import type { AccountStore } from "../../services/AccountStore";
import type { MastodonApi } from "../../services/MastodonApi";
import type { OAuthClient } from "../../services/OAuthClient";
import type { StreamingClient } from "../../services/StreamingClient";
import { formatHandle, parseAccountLabel } from "../utils/account";

const ACTIVE_ACCOUNT_KEY = "textodon.accounts.activeId";

const loadActiveAccountId = (accounts: Account[]): string | null => {
  if (accounts.length === 0) {
    return null;
  }
  try {
    const stored = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (stored && accounts.some((account) => account.id === stored)) {
      return stored;
    }
  } catch {
    return accounts[0]?.id ?? null;
  }
  return accounts[0]?.id ?? null;
};

const areEmojisEqual = (left: CustomEmoji[], right: CustomEmoji[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((emoji, index) => {
    const target = right[index];
    return (
      emoji.shortcode === target.shortcode &&
      emoji.url === target.url &&
      (emoji.category ?? null) === (target.category ?? null)
    );
  });
};

const persistActiveAccountId = (accountId: string | null) => {
  try {
    if (accountId) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  } catch {
    return;
  }
};

export type AppServices = {
  api: MastodonApi;
  streaming: StreamingClient;
  accountStore: AccountStore;
  oauth: OAuthClient;
};

export type AccountsState = {
  accounts: Account[];
  activeAccountId: string | null;
  addAccount: (account: Account) => void;
  removeAccount: (accountId: string) => void;
  setActiveAccount: (accountId: string) => void;
  updateAccount: (accountId: string, account: Account) => void;
};

const AppContext = createContext<{ services: AppServices; accountsState: AccountsState } | null>(null);

export const AppProvider = ({ services, children }: { services: AppServices; children: React.ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const loaded = services.accountStore.load();
    const normalized = loaded.map((account) => {
      const platform = account.platform ?? "mastodon";
      if (account.displayName && account.handle) {
        const fullHandle = formatHandle(account.handle, account.instanceUrl);
        return { ...account, platform, handle: fullHandle, emojis: account.emojis ?? [] };
      }
      const parsed = account.name ? parseAccountLabel(account.name) : null;
      const displayName = parsed?.displayName || account.name || account.instanceUrl;
      const handle = formatHandle(parsed?.handle || "", account.instanceUrl);
      return {
        ...account,
        platform,
        displayName,
        handle,
        url: account.url ?? null,
        avatarUrl: account.avatarUrl ?? null,
        emojis: account.emojis ?? []
      };
    });
    services.accountStore.save(normalized);
    return normalized;
  });
  const [activeAccountId, setActiveAccountId] = useState<string | null>(
    loadActiveAccountId(accounts)
  );

  useEffect(() => {
    persistActiveAccountId(activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    if (accounts.length > 0) {
      services.accountStore.save(accounts);
    }
  }, [accounts, services.accountStore]);

  const persist = useCallback(
    (next: Account[]) => {
      setAccounts(next);
      services.accountStore.save(next);
    },
    [services.accountStore]
  );

  useEffect(() => {
    if (accounts.length === 0) {
      return;
    }

    let cancelled = false;
    const refreshAccounts = async () => {
      const refreshed = await Promise.all(
        accounts.map(async (account) => {
          try {
            const verified = await services.api.verifyAccount(account);
            const handle = formatHandle(verified.handle, account.instanceUrl);
            const displayName = verified.accountName || handle;
            return {
              ...account,
              name: `${displayName} @${handle}`,
              displayName,
              handle,
              avatarUrl: verified.avatarUrl,
              emojis: verified.emojis ?? []
            };
          } catch {
            return account;
          }
        })
      );
      if (cancelled) {
        return;
      }
      const hasChange = refreshed.some((updated) => {
        const current = accounts.find((account) => account.id === updated.id);
        if (!current) {
          return true;
        }
        return (
          current.name !== updated.name ||
          current.displayName !== updated.displayName ||
          current.handle !== updated.handle ||
          current.avatarUrl !== updated.avatarUrl ||
          !areEmojisEqual(current.emojis ?? [], updated.emojis ?? [])
        );
      });
      if (!hasChange) {
        return;
      }
      persist(refreshed);
    };

    void refreshAccounts();
    return () => {
      cancelled = true;
    };
  }, [accounts, persist, services.api]);

  const addAccount = useCallback(
    (account: Account) => {
      persist([...accounts, account]);
      setActiveAccountId(account.id);
    },
    [accounts, persist]
  );

  const removeAccount = useCallback(
    (accountId: string) => {
      const next = accounts.filter((item) => item.id !== accountId);
      persist(next);
      if (activeAccountId === accountId) {
        setActiveAccountId(next[0]?.id ?? null);
      }
    },
    [accounts, activeAccountId, persist]
  );

  const setActiveAccount = useCallback((accountId: string) => {
    setActiveAccountId(accountId);
  }, []);

  const updateAccount = useCallback(
    (accountId: string, account: Account) => {
      const next = accounts.map((item) => (item.id === accountId ? account : item));
      persist(next);
    },
    [accounts, persist]
  );

  const accountsState = useMemo(
    () => ({ accounts, activeAccountId, addAccount, removeAccount, setActiveAccount, updateAccount }),
    [accounts, activeAccountId, addAccount, removeAccount, setActiveAccount, updateAccount]
  );

  return (
    <AppContext.Provider value={{ services, accountsState }}>{children}</AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("AppContext provider가 필요합니다.");
  }
  return context;
};
