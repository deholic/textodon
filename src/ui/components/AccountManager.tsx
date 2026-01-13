import React, { useState } from "react";
import type { Account } from "../../domain/types";
import type { OAuthClient } from "../../services/OAuthClient";
import { formatHandle, normalizeInstanceUrl } from "../utils/account";
import { createOauthState, loadRegisteredApp, saveRegisteredApp, storePendingOAuth } from "../utils/oauth";
import { AccountLabel } from "./AccountLabel";

export const AccountManager = ({
  accounts,
  activeAccountId,
  setActiveAccount,
  removeAccount,
  oauth
}: {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  removeAccount: (id: string) => void;
  oauth: OAuthClient;
}) => {
  const [instanceUrl, setInstanceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reauthLoadingId, setReauthLoadingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const startOAuthFlow = async (normalizedUrl: string, accountId?: string) => {
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
    storePendingOAuth({ ...registered, state, accountId });
    const authorizeUrl = oauth.buildAuthorizeUrl(registered, state);
    window.location.assign(authorizeUrl);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalizedUrl = normalizeInstanceUrl(instanceUrl);
    if (!normalizedUrl) {
      setError("서버 주소를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      await startOAuthFlow(normalizedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleReauth = async (account: Account) => {
    setReauthError(null);
    setReauthLoadingId(account.id);
    try {
      const normalizedUrl = normalizeInstanceUrl(account.instanceUrl);
      await startOAuthFlow(normalizedUrl, account.id);
    } catch (err) {
      setReauthError(err instanceof Error ? err.message : "OAuth 재인증에 실패했습니다.");
      setReauthLoadingId(null);
    }
  };

  return (
    <section className="panel">
      <div className="account-header">
        <h2>계정</h2>
      </div>
      <ul className="account-list">
        {accounts.map((account) => (
          <li key={account.id} className={account.id === activeAccountId ? "active" : ""}>
            <button type="button" onClick={() => setActiveAccount(account.id)}>
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
                onClick={() => handleReauth(account)}
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
          </li>
        ))}
        {accounts.length === 0 ? <li className="empty">등록된 계정이 없습니다.</li> : null}
      </ul>
      {reauthError ? <p className="error">{reauthError}</p> : null}

      <button
        type="button"
        className="account-add-button button-with-icon"
        onClick={() => setShowForm((prev) => !prev)}
        aria-label={showForm ? "계정 추가 닫기" : "계정 추가"}
      >
        {showForm ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6l-12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        )}
        {showForm ? "계정 추가 닫기" : "계정 추가"}
      </button>

      {showForm ? (
        <form className="account-form account-form-divider" onSubmit={handleSubmit}>
          <label>
            서버 주소
            <input
              type="text"
              placeholder="mastodon.social"
              value={instanceUrl}
              onChange={(event) => setInstanceUrl(event.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "연결 중..." : "OAuth로 연결"}
          </button>
        </form>
      ) : null}
      {showForm ? <p className="hint">OAuth 승인 후 자동으로 돌아옵니다.</p> : null}
    </section>
  );
};
