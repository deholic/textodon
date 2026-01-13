import React, { useMemo, useRef, useState } from "react";
import type { Account } from "../../domain/types";
import type { OAuthClient } from "../../services/OAuthClient";
import { formatHandle, normalizeInstanceUrl } from "../utils/account";
import { useClickOutside } from "../hooks/useClickOutside";
import { createOauthState, loadRegisteredApp, saveRegisteredApp, storePendingOAuth } from "../utils/oauth";
import { AccountLabel } from "./AccountLabel";

export const AccountSelector = ({
  accounts,
  activeAccountId,
  setActiveAccount,
  removeAccount,
  oauth,
  variant = "panel"
}: {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  removeAccount: (id: string) => void;
  oauth: OAuthClient;
  variant?: "panel" | "inline";
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reauthLoadingId, setReauthLoadingId] = useState<string | null>(null);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(dropdownRef, dropdownOpen, () => setDropdownOpen(false));

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const wrapperClassName =
    variant === "panel" ? "panel account-selector-panel" : "account-selector-inline";
  const Wrapper = variant === "panel" ? "section" : "div";

  const startOAuthFlow = async (account: Account) => {
    setReauthError(null);
    setReauthLoadingId(account.id);
    try {
      const normalizedUrl = normalizeInstanceUrl(account.instanceUrl);
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      const redirectUri = url.toString();
      const cached = loadRegisteredApp(normalizedUrl);
      const needsRegister = !cached || cached.redirectUri !== redirectUri || cached.platform === "misskey";
      const registered = needsRegister ? await oauth.registerApp(normalizedUrl, redirectUri) : cached;
      if (!registered) {
        throw new Error("앱 등록 정보를 불러오지 못했습니다.");
      }
      if (needsRegister && registered.platform === "mastodon") {
        saveRegisteredApp(registered);
      }
      const state = createOauthState();
      storePendingOAuth({ ...registered, state, accountId: account.id });
      const authorizeUrl = oauth.buildAuthorizeUrl(registered, state);
      window.location.assign(authorizeUrl);
    } catch (err) {
      setReauthError(err instanceof Error ? err.message : "OAuth 재인증에 실패했습니다.");
      setReauthLoadingId(null);
    }
  };

  return (
    <Wrapper className={wrapperClassName}>
      <div className="account-selector-header">
        <details
          className="account-selector"
          open={dropdownOpen}
          onToggle={(event) => setDropdownOpen(event.currentTarget.open)}
        >
          <summary className="account-selector-summary">
            {activeAccount ? (
              <AccountLabel
                avatarUrl={activeAccount.avatarUrl}
                displayName={activeAccount.displayName}
                name={activeAccount.name}
                handle={activeAccount.handle ? formatHandle(activeAccount.handle, activeAccount.instanceUrl) : undefined}
                instanceUrl={activeAccount.instanceUrl}
                customEmojis={activeAccount.emojis}
              />
            ) : (
              <span className="account-selector-placeholder">계정을 선택하세요.</span>
            )}
            <span className="account-selector-caret" aria-hidden="true">
              ▾
            </span>
          </summary>
          {dropdownOpen ? <div className="overlay-backdrop" aria-hidden="true" /> : null}
          <div ref={dropdownRef} className="account-selector-dropdown">
            <ul className="account-list">
              {accounts.map((account) => {
                const isActiveAccount = account.id === activeAccountId;
                return (
                  <li key={account.id} className={isActiveAccount ? "active" : ""}>
                    <div className="account-row">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAccount(account.id);
                          setDropdownOpen(false);
                        }}
                      >
                        <AccountLabel
                          avatarUrl={account.avatarUrl}
                          displayName={account.displayName}
                          name={account.name}
                          handle={account.handle ? formatHandle(account.handle, account.instanceUrl) : undefined}
                          instanceUrl={account.instanceUrl}
                          customEmojis={account.emojis}
                        />
                      </button>
                      <div className="account-row-actions">
                        <button
                          type="button"
                          onClick={() => startOAuthFlow(account)}
                          className="ghost"
                          aria-label="계정 재인증"
                          disabled={reauthLoadingId === account.id}
                        >
                          재인증
                        </button>
                        <button type="button" onClick={() => removeAccount(account.id)} className="ghost">
                          삭제
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {accounts.length === 0 ? <li className="empty">등록된 계정이 없습니다.</li> : null}
            </ul>
            {reauthError ? <p className="error account-selector-error">{reauthError}</p> : null}
          </div>
        </details>
      </div>
    </Wrapper>
  );
};
