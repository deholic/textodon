import React, { useState } from "react";
import type { Account } from "../../domain/types";
import type { OAuthClient } from "../../services/OAuthClient";
import { normalizeInstanceUrl } from "../utils/account";
import { createOauthState, loadRegisteredApp, saveRegisteredApp, storePendingOAuth } from "../utils/oauth";

export const AccountAdd = ({
  accounts,
  setActiveAccount,
  oauth
}: {
  accounts: Account[];
  setActiveAccount: (id: string) => void;
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
    <div className="account-add-wrapper">
      <button
        type="button"
        className="account-add-button header button-with-icon"
        onClick={() => setShowForm((prev) => !prev)}
        aria-label={showForm ? "서버 추가 닫기" : "서버 추가"}
        aria-expanded={showForm}
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
        <div className="account-add-panel">
          <form className="account-form" onSubmit={handleSubmit}>
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
          <p className="hint">OAuth 승인 후 자동으로 돌아옵니다.</p>
        </div>
      ) : null}
    </div>
  );
};
