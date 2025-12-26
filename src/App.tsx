import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Status } from "./domain/types";
import { AccountAdd } from "./ui/components/AccountAdd";
import { AccountSelector } from "./ui/components/AccountSelector";
import { ComposeBox } from "./ui/components/ComposeBox";
import { TimelineItem } from "./ui/components/TimelineItem";
import { useTimeline } from "./ui/hooks/useTimeline";
import { useAppContext } from "./ui/state/AppContext";
import type { AccountsState, AppServices } from "./ui/state/AppContext";
import { createAccountId, formatHandle } from "./ui/utils/account";
import { clearPendingOAuth, loadPendingOAuth } from "./ui/utils/oauth";
import logoUrl from "./ui/assets/textodon-icon-blue.png";
import readmeText from "../README.md?raw";
import { renderMarkdown } from "./ui/utils/markdown";

type Route = "home" | "terms" | "license" | "oss";
type TimelineSectionConfig = { id: string; accountId: string | null };

const SECTION_STORAGE_KEY = "textodon.sections";

const parseRoute = (): Route => {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash || hash === "/") {
    return "home";
  }
  const path = hash.startsWith("/") ? hash.slice(1) : hash;
  if (path === "terms") return "terms";
  if (path === "license") return "license";
  if (path === "oss") return "oss";
  return "home";
};

const PageHeader = ({ title }: { title: string }) => (
  <div className="page-header">
    <a href="#/" className="back-link">
      <span className="back-icon" aria-hidden="true">
        ←
      </span>
      타임라인으로 돌아가기
    </a>
    <h2>{title}</h2>
  </div>
);

const TermsPage = () => (
  <section className="panel info-panel">
    <PageHeader title="이용약관" />
    <p>
      textodon은 개인 또는 팀이 운영하는 마스토돈 인스턴스에 접속하는 클라이언트입니다. 본
      서비스는 사용자의 계정 정보 및 게시물을 저장하지 않으며, 모든 요청은 사용자가 설정한
      인스턴스로 직접 전송됩니다.
    </p>
    <p>
      사용자는 각 인스턴스의 정책과 법령을 준수해야 하며, 계정 보안과 토큰 관리 책임은
      사용자에게 있습니다. 서비스는 제공되는 기능을 개선하거나 변경할 수 있습니다.
    </p>
  </section>
);

const LicensePage = () => (
  <section className="panel info-panel">
    <PageHeader title="라이선스" />
    <pre className="license">
{`MIT License

Copyright (c) 2024 textodon contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
    </pre>
  </section>
);

const OssPage = () => (
  <section className="panel info-panel">
    <PageHeader title="오픈소스 목록" />
    <p>textodon은 다음 오픈소스를 사용합니다.</p>
    <ul className="oss-list">
      <li>react</li>
      <li>react-dom</li>
      <li>vite</li>
      <li>@vitejs/plugin-react</li>
      <li>typescript</li>
      <li>@types/react</li>
      <li>@types/react-dom</li>
    </ul>
  </section>
);

const TimelineSection = ({
  section,
  account,
  services,
  accountsState,
  onAccountChange,
  onReply,
  onError,
  registerTimelineListener,
  unregisterTimelineListener
}: {
  section: TimelineSectionConfig;
  account: Account | null;
  services: AppServices;
  accountsState: AccountsState;
  onAccountChange: (sectionId: string, accountId: string | null) => void;
  onReply: (status: Status, account: Account | null) => void;
  onError: (message: string | null) => void;
  registerTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
  unregisterTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
}) => {
  const timeline = useTimeline({
    account,
    api: services.api,
    streaming: services.streaming
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const onScroll = () => {
      const threshold = el.scrollHeight - el.clientHeight - 200;
      if (el.scrollTop >= threshold) {
        timeline.loadMore();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [timeline.loadMore]);

  useEffect(() => {
    if (!account) {
      return;
    }
    registerTimelineListener(account.id, timeline.updateItem);
    return () => {
      unregisterTimelineListener(account.id, timeline.updateItem);
    };
  }, [account, registerTimelineListener, timeline.updateItem, unregisterTimelineListener]);

  const handleToggleFavourite = async (status: Status) => {
    if (!account) {
      onError("계정을 선택해주세요.");
      return;
    }
    onError(null);
    try {
      const updated = status.favourited
        ? await services.api.unfavourite(account, status.id)
        : await services.api.favourite(account, status.id);
      timeline.updateItem(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "좋아요 처리에 실패했습니다.");
    }
  };

  const handleToggleReblog = async (status: Status) => {
    if (!account) {
      onError("계정을 선택해주세요.");
      return;
    }
    onError(null);
    try {
      const updated = status.reblogged
        ? await services.api.unreblog(account, status.id)
        : await services.api.reblog(account, status.id);
      timeline.updateItem(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "부스트 처리에 실패했습니다.");
    }
  };

  const handleDeleteStatus = async (status: Status) => {
    if (!account) {
      return;
    }
    onError(null);
    try {
      await services.api.deleteStatus(account, status.id);
      timeline.removeItem(status.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "게시글 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="timeline-column">
      <div className="timeline-column-header">
        <AccountSelector
          accounts={accountsState.accounts}
          activeAccountId={account?.id ?? null}
          setActiveAccount={(id) => {
            onAccountChange(section.id, id);
            accountsState.setActiveAccount(id);
          }}
          removeAccount={accountsState.removeAccount}
          variant="inline"
        />
        <div className="timeline-column-actions">
          <button type="button" onClick={timeline.refresh} disabled={!account || timeline.loading}>
            {timeline.loading ? "새로고침 중" : "새로고침"}
          </button>
        </div>
      </div>
      <div className="timeline-column-body" ref={scrollRef}>
        {!account ? <p className="empty">계정을 선택하면 타임라인을 불러옵니다.</p> : null}
        {account && timeline.error ? <p className="error">{timeline.error}</p> : null}
        {account && timeline.items.length === 0 && !timeline.loading ? (
          <p className="empty">표시할 글이 없습니다.</p>
        ) : null}
        {account && timeline.items.length > 0 ? (
          <div className="timeline">
            {timeline.items.map((status) => (
              <TimelineItem
                key={status.id}
                status={status}
                onReply={(item) => onReply(item, account)}
                onToggleFavourite={handleToggleFavourite}
                onToggleReblog={handleToggleReblog}
                onDelete={handleDeleteStatus}
                activeHandle={
                  account.handle ? formatHandle(account.handle, account.instanceUrl) : account.instanceUrl
                }
              />
            ))}
          </div>
        ) : null}
        {timeline.loadingMore ? <p className="empty">더 불러오는 중...</p> : null}
      </div>
    </div>
  );
};

export const App = () => {
  const [christmasMode, setChristmasMode] = useState(() => {
    return localStorage.getItem("textodon.christmas") === "on";
  });
  const { services, accountsState } = useAppContext();
  const [sections, setSections] = useState<TimelineSectionConfig[]>(() => {
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TimelineSectionConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: item.id || crypto.randomUUID(),
            accountId: item.accountId ?? null
          }));
        }
      }
    } catch {
      /* noop */
    }
    return [{ id: crypto.randomUUID(), accountId: accountsState.activeAccountId ?? null }];
  });
  const [composeAccountId, setComposeAccountId] = useState<string | null>(accountsState.activeAccountId);
  const composeAccount = useMemo(
    () => accountsState.accounts.find((account) => account.id === composeAccountId) ?? null,
    [accountsState.accounts, composeAccountId]
  );
  const [replyTarget, setReplyTarget] = useState<Status | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mentionSeed, setMentionSeed] = useState<string | null>(null);
  const replySummary = replyTarget
    ? `@${replyTarget.accountHandle} · ${replyTarget.content.slice(0, 80)}`
    : null;
  const readmeHtml = useMemo(() => renderMarkdown(readmeText), [readmeText]);
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const timelineListeners = useRef<Map<string, Set<(status: Status) => void>>>(new Map());

  const registerTimelineListener = useCallback((accountId: string, listener: (status: Status) => void) => {
    const next = new Map(timelineListeners.current);
    const existing = next.get(accountId) ?? new Set();
    const updated = new Set(existing);
    updated.add(listener);
    next.set(accountId, updated);
    timelineListeners.current = next;
  }, []);

  const unregisterTimelineListener = useCallback(
    (accountId: string, listener: (status: Status) => void) => {
      const next = new Map(timelineListeners.current);
      const existing = next.get(accountId);
      if (!existing) {
        return;
      }
      existing.delete(listener);
      if (existing.size === 0) {
        next.delete(accountId);
      } else {
        next.set(accountId, new Set(existing));
      }
      timelineListeners.current = next;
    },
    []
  );

  const broadcastStatusUpdate = useCallback((accountId: string, status: Status) => {
    const listeners = timelineListeners.current.get(accountId);
    if (!listeners) {
      return;
    }
    listeners.forEach((listener) => listener(status));
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code) {
      return;
    }

    const pending = loadPendingOAuth();
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = "";
    cleanUrl.hash = "";
    window.history.replaceState({}, "", cleanUrl.toString());

    if (!pending || !state || pending.state !== state) {
      clearPendingOAuth();
      setActionError("OAuth 상태가 유효하지 않습니다. 다시 시도해주세요.");
      return;
    }

    const addAccountWithToken = async () => {
      setOauthLoading(true);
      setActionError(null);
      try {
        const accessToken = await services.oauth.exchangeCode({
          instanceUrl: pending.instanceUrl,
          clientId: pending.clientId,
          clientSecret: pending.clientSecret,
          redirectUri: pending.redirectUri,
          code,
          scope: pending.scope
        });
        const draft: Account = {
          id: createAccountId(),
          instanceUrl: pending.instanceUrl,
          accessToken,
          name: "",
          displayName: "",
          handle: "",
          url: null,
          avatarUrl: null
        };
        const verified = await services.api.verifyAccount(draft);
        const fullHandle = formatHandle(verified.handle, pending.instanceUrl);
        const displayName = verified.accountName || fullHandle;
        accountsState.addAccount({
          ...draft,
          name: `${displayName} @${fullHandle}`,
          displayName,
          handle: fullHandle,
          avatarUrl: verified.avatarUrl
        });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "OAuth 처리에 실패했습니다.");
      } finally {
        clearPendingOAuth();
        setOauthLoading(false);
      }
    };

    void addAccountWithToken();
  }, [accountsState, services.api, services.oauth]);

  useEffect(() => {
    const value = christmasMode ? "christmas" : "";
    document.documentElement.dataset.theme = value;
    document.body.dataset.theme = value;
    localStorage.setItem("textodon.christmas", christmasMode ? "on" : "off");
  }, [christmasMode]);

  useEffect(() => {
    setSections((current) =>
      current.map((section) =>
        section.accountId && accountsState.accounts.some((account) => account.id === section.accountId)
          ? section
          : { ...section, accountId: null }
      )
    );
    setComposeAccountId((current) => {
      if (!current) {
        return accountsState.accounts[0]?.id ?? null;
      }
      return accountsState.accounts.some((account) => account.id === current)
        ? current
        : accountsState.accounts[0]?.id ?? null;
    });
  }, [accountsState.accounts]);

  const handleSubmit = async (params: {
    text: string;
    visibility: "public" | "unlisted" | "private" | "direct";
    inReplyToId?: string;
    files: File[];
  }): Promise<boolean> => {
    if (!composeAccount) {
      return false;
    }
    setActionError(null);
    try {
      const mediaIds =
        params.files.length > 0
          ? await Promise.all(params.files.map((file) => services.api.uploadMedia(composeAccount, file)))
          : [];
      const created = await services.api.createStatus(composeAccount, {
        status: params.text,
        visibility: params.visibility,
        inReplyToId: params.inReplyToId,
        mediaIds
      });
      broadcastStatusUpdate(composeAccount.id, created);
      setReplyTarget(null);
      setMentionSeed(null);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "글 작성에 실패했습니다.");
      return false;
    }
  };

  const handleReply = (status: Status, account: Account | null) => {
    if (!account) {
      return;
    }
    setComposeAccountId(account.id);
    setReplyTarget(status);
    setMentionSeed(`@${status.accountHandle}`);
  };

  const addSection = () => {
    const defaultAccountId = composeAccountId ?? accountsState.accounts[0]?.id ?? null;
    setSections((current) => [...current, { id: crypto.randomUUID(), accountId: defaultAccountId }]);
    if (!composeAccountId && defaultAccountId) {
      setComposeAccountId(defaultAccountId);
    }
  };

  const setSectionAccount = (sectionId: string, accountId: string | null) => {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, accountId } : section))
    );
  };

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections));
    } catch {
      /* noop */
    }
  }, [sections]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img src={logoUrl} alt="textodon logo" />
          <div className="brand-text">
            <h1>textodon</h1>
            <p>텍스트 중심 마스토돈 클라이언트</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-actions-group">
            <AccountAdd
              accounts={accountsState.accounts}
              setActiveAccount={accountsState.setActiveAccount}
              oauth={services.oauth}
            />
            <button type="button" onClick={addSection}>타임라인 섹션 추가</button>
          </div>
        </div>
      </header>

      <main className="layout">
        <aside>
          {composeAccount ? (
            <ComposeBox
              accountSelector={
                <AccountSelector
                  accounts={accountsState.accounts}
                  activeAccountId={composeAccountId}
                  setActiveAccount={setComposeAccountId}
                  removeAccount={accountsState.removeAccount}
                  variant="inline"
                />
              }
              onSubmit={handleSubmit}
              replyingTo={replyTarget ? { id: replyTarget.id, summary: replySummary ?? "" } : null}
              onCancelReply={() => {
                setReplyTarget(null);
                setMentionSeed(null);
              }}
              mentionText={mentionSeed}
            />
          ) : null}
          {route === "home" ? (
            <section className="panel">
              <p className="sidebar-description">
                textodon은 텍스트 중심으로 마스토돈을 읽고 쓰기 위한 클라이언트입니다.
              </p>
              <nav className="sidebar-links">
                <a href="#/terms">이용약관</a>
                <a href="#/license">라이선스</a>
                <a href="#/oss">오픈소스 목록</a>
                <a href="https://github.com/deholic/textodon" target="_blank" rel="noreferrer">
                  소스 코드
                </a>
              </nav>
            </section>
          ) : null}
          <section className="panel christmas-toggle">
            <div>
              <strong>크리스마스 모드</strong>
              <p>레드/그린 테마로 전환합니다.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={christmasMode}
                onChange={(event) => setChristmasMode(event.target.checked)}
              />
              <span className="slider" aria-hidden="true" />
            </label>
          </section>
        </aside>

        <section className="main-column">
          {oauthLoading ? <p className="empty">OAuth 인증 중...</p> : null}
          {actionError ? <p className="error">{actionError}</p> : null}
          {route === "home" ? (
            <section className="panel">
              <div className="timeline-board">
                {sections.map((section) => (
                  <TimelineSection
                    key={section.id}
                    section={section}
                    account={
                      section.accountId
                        ? accountsState.accounts.find((account) => account.id === section.accountId) ?? null
                        : null
                    }
                    services={services}
                    accountsState={accountsState}
                    onAccountChange={setSectionAccount}
                    onReply={handleReply}
                    onError={(message) => setActionError(message || null)}
                    registerTimelineListener={registerTimelineListener}
                    unregisterTimelineListener={unregisterTimelineListener}
                  />
                ))}
              </div>
              {accountsState.accounts.length === 0 ? (
                <div className="timeline-readme">
                  <h3>안내</h3>
                  <div className="readme-text" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
                </div>
              ) : null}
            </section>
          ) : null}
          {route === "terms" ? <TermsPage /> : null}
          {route === "license" ? <LicensePage /> : null}
          {route === "oss" ? <OssPage /> : null}
        </section>
      </main>
    </div>
  );
};
