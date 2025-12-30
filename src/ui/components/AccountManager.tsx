import React, { useState } from "react";
import type { Account } from "../../domain/types";
import type { OAuthClient } from "../../services/OAuthClient";
import { formatHandle, normalizeInstanceUrl } from "../utils/account";
import { createOauthState, loadRegisteredApp, saveRegisteredApp, storePendingOAuth } from "../utils/oauth";

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
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalizedUrl = normalizeInstanceUrl(instanceUrl);
    if (!normalizedUrl) {
      setError("서버 주소를 입력해주세요.");
      return;
    }
    const existing = accounts.find((account) => account.instanceUrl === normalizedUrl);
    if (existing) {
      setActiveAccount(existing.id);
      setInstanceUrl("");
      setShowForm(false);
      return;
    }

    setLoading(true);
    try {
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
      storePendingOAuth({ ...registered, state });
      const authorizeUrl = oauth.buildAuthorizeUrl(registered, state);
      window.location.assign(authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth 연결에 실패했습니다.");
    } finally {
      setLoading(false);
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
              <span className="account-label">
                <span className="account-avatar" aria-hidden="true">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="account-avatar-fallback" />
                  )}
                </span>
                <span className="account-text">
                  <span>{account.displayName || account.name || account.instanceUrl}</span>
                  {account.handle ? (
                    <span className="account-handle">
                      @{formatHandle(account.handle, account.instanceUrl)}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => removeAccount(account.id)} className="ghost">
              삭제
            </button>
          </li>
        ))}
        {accounts.length === 0 ? <li className="empty">등록된 계정이 없습니다.</li> : null}
      </ul>

      <button
        type="button"
        className="account-add-button button-with-icon"
        onClick={() => setShowForm((prev) => !prev)}
        aria-label={showForm ? "서버 추가 닫기" : "서버 추가"}
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
        {showForm ? "서버 추가 닫기" : "서버 추가"}
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
