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
import licenseText from "../LICENSE?raw";
import { renderMarkdown } from "./ui/utils/markdown";

type Route = "home" | "terms" | "license" | "oss";
type TimelineSectionConfig = { id: string; accountId: string | null };

const SECTION_STORAGE_KEY = "textodon.sections";
const COMPOSE_ACCOUNT_KEY = "textodon.compose.accountId";

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
      Deck은 개인 또는 팀이 운영하는 마스토돈 인스턴스에 접속하는 클라이언트입니다. 본
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
    <pre className="license">{licenseText}</pre>
  </section>
);

const OssPage = () => (
  <section className="panel info-panel">
    <PageHeader title="오픈소스 목록" />
    <p>Deck은 다음 오픈소스를 사용합니다.</p>
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
  onAddSectionLeft,
  onAddSectionRight,
  onRemoveSection,
  onReply,
  onError,
  onMoveSection,
  canMoveLeft,
  canMoveRight,
  canRemoveSection,
  showProfileImage,
  showCustomEmojis,
  showReactions,
  registerTimelineListener,
  unregisterTimelineListener
}: {
  section: TimelineSectionConfig;
  account: Account | null;
  services: AppServices;
  accountsState: AccountsState;
  onAccountChange: (sectionId: string, accountId: string | null) => void;
  onAddSectionLeft: (sectionId: string) => void;
  onAddSectionRight: (sectionId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onReply: (status: Status, account: Account | null) => void;
  onError: (message: string | null) => void;
  onMoveSection: (sectionId: string, direction: "left" | "right") => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canRemoveSection: boolean;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
  showReactions: boolean;
  registerTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
  unregisterTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
}) => {
  const timeline = useTimeline({
    account,
    api: services.api,
    streaming: services.streaming
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

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
      setIsAtTop(el.scrollTop <= 0);
    };
    onScroll();
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

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current || !(event.target instanceof Node)) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest(".overlay-backdrop")
      ) {
        setMenuOpen(false);
        return;
      }
      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);

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
    const delta = status.reblogged ? -1 : 1;
    const optimistic = {
      ...status,
      reblogged: !status.reblogged,
      reblogsCount: Math.max(0, status.reblogsCount + delta)
    };
    timeline.updateItem(optimistic);
    try {
      const updated = status.reblogged
        ? await services.api.unreblog(account, status.id)
        : await services.api.reblog(account, status.id);
      timeline.updateItem(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "부스트 처리에 실패했습니다.");
      timeline.updateItem(status);
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

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
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
        <div className="timeline-column-actions" role="group" aria-label="타임라인 작업">
          <div className="section-menu" ref={menuRef}>
            <button
              type="button"
              className="icon-button menu-button"
              aria-label="섹션 메뉴 열기"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>
            {menuOpen ? (
              <>
                <div
                  className="overlay-backdrop"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="section-menu-panel" role="menu">
                  <div className="section-menu-mobile">
                    <button type="button" onClick={scrollToTop}>
                      최상단으로
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        timeline.refresh();
                        setMenuOpen(false);
                      }}
                      disabled={!account || timeline.loading}
                    >
                      새로고침
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onAddSectionLeft(section.id);
                      setMenuOpen(false);
                    }}
                  >
                    왼쪽 섹션 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMoveSection(section.id, "left");
                      setMenuOpen(false);
                    }}
                    disabled={!canMoveLeft}
                  >
                    왼쪽으로 이동
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMoveSection(section.id, "right");
                      setMenuOpen(false);
                    }}
                    disabled={!canMoveRight}
                  >
                    오른쪽으로 이동
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddSectionRight(section.id);
                      setMenuOpen(false);
                    }}
                  >
                    오른쪽 섹션 추가
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={!canRemoveSection}
                    onClick={() => {
                      onRemoveSection(section.id);
                      setMenuOpen(false);
                    }}
                  >
                    섹션 삭제
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={scrollToTop}
            disabled={isAtTop}
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={timeline.refresh}
            disabled={!account || timeline.loading}
            aria-label={timeline.loading ? "새로고침 중" : "새로고침"}
            title={timeline.loading ? "새로고침 중" : "새로고침"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v6h-6" />
            </svg>
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
                        activeAccountHandle={account.handle ?? ""}
                        activeAccountUrl={account.url ?? null}
                        showProfileImage={showProfileImage}
                        showCustomEmojis={showCustomEmojis}
                        showReactions={showReactions}
                      />
            ))}
          </div>
        ) : null}
        {timeline.loadingMore ? <p className="empty">더 불러오는 중...</p> : null}
      </div>
    </div>
  );
};

type ThemeMode = "default" | "christmas" | "sky-pink" | "monochrome";

const isThemeMode = (value: string): value is ThemeMode =>
  value === "default" || value === "christmas" || value === "sky-pink" || value === "monochrome";

const getStoredTheme = (): ThemeMode => {
  const storedTheme = localStorage.getItem("textodon.theme");
  if (storedTheme && isThemeMode(storedTheme)) {
    return storedTheme;
  }
  return localStorage.getItem("textodon.christmas") === "on" ? "christmas" : "default";
};

type ColorScheme = "system" | "light" | "dark";

const isColorScheme = (value: string): value is ColorScheme =>
  value === "system" || value === "light" || value === "dark";

const getStoredColorScheme = (): ColorScheme => {
  const storedScheme = localStorage.getItem("textodon.colorScheme");
  if (storedScheme && isColorScheme(storedScheme)) {
    return storedScheme;
  }
  return "system";
};

export const App = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => getStoredColorScheme());
  const [sectionSize, setSectionSize] = useState<"small" | "medium" | "large">(() => {
    const stored = localStorage.getItem("textodon.sectionSize");
    if (stored === "medium" || stored === "large" || stored === "small") {
      return stored;
    }
    return "small";
  });
  const [showProfileImages, setShowProfileImages] = useState(() => {
    return localStorage.getItem("textodon.profileImages") !== "off";
  });
  const [showCustomEmojis, setShowCustomEmojis] = useState(() => {
    return localStorage.getItem("textodon.customEmojis") !== "off";
  });
  const [showMisskeyReactions, setShowMisskeyReactions] = useState(() => {
    return localStorage.getItem("textodon.reactions") !== "off";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileComposeOpen, setMobileComposeOpen] = useState(false);
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
    if (accountsState.accounts.length === 0) {
      return [];
    }
    return [
      {
        id: crypto.randomUUID(),
        accountId: accountsState.activeAccountId ?? accountsState.accounts[0]?.id ?? null
      }
    ];
  });
  const [composeAccountId, setComposeAccountId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(COMPOSE_ACCOUNT_KEY);
      if (stored) {
        return stored;
      }
    } catch {
      /* noop */
    }
    return accountsState.activeAccountId;
  });
  const composeAccount = useMemo(
    () => accountsState.accounts.find((account) => account.id === composeAccountId) ?? null,
    [accountsState.accounts, composeAccountId]
  );
  const [replyTarget, setReplyTarget] = useState<Status | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mentionSeed, setMentionSeed] = useState<string | null>(null);
  const timelineBoardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; scrollLeft: number; pointerId: number } | null>(null);
  const [isBoardDragging, setIsBoardDragging] = useState(false);
  const replySummary = replyTarget
    ? `@${replyTarget.accountHandle} · ${replyTarget.content.slice(0, 80)}`
    : null;
  const readmeHtml = useMemo(() => renderMarkdown(readmeText), [readmeText]);
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const timelineListeners = useRef<Map<string, Set<(status: Status) => void>>>(new Map());
  const previousAccountIds = useRef<Set<string>>(new Set());

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
    const session = params.get("session");
    if (!code && !session) {
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
    if (pending.platform === "mastodon" && !code) {
      clearPendingOAuth();
      setActionError("OAuth 코드를 받지 못했습니다. 다시 시도해주세요.");
      return;
    }
    if (pending.platform === "misskey") {
      if (!session) {
        clearPendingOAuth();
        setActionError("미스키 세션 정보를 받지 못했습니다. 다시 시도해주세요.");
        return;
      }
      if (session !== pending.sessionId) {
        clearPendingOAuth();
        setActionError("미스키 세션 정보가 일치하지 않습니다. 다시 시도해주세요.");
        return;
      }
    }

    const addAccountWithToken = async () => {
      setOauthLoading(true);
      setActionError(null);
      try {
        const accessToken = await services.oauth.exchangeToken({
          app: pending,
          callback: { code, state, session }
        });
        const draft: Account = {
          id: createAccountId(),
          instanceUrl: pending.instanceUrl,
          accessToken,
          platform: pending.platform,
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
    const value = themeMode === "default" ? "" : themeMode;
    if (value) {
      document.documentElement.dataset.theme = value;
      document.body.dataset.theme = value;
    } else {
      delete document.documentElement.dataset.theme;
      delete document.body.dataset.theme;
    }
    localStorage.setItem("textodon.theme", themeMode);
    localStorage.setItem("textodon.christmas", themeMode === "christmas" ? "on" : "off");
  }, [themeMode]);

  useEffect(() => {
    if (colorScheme === "system") {
      delete document.documentElement.dataset.colorScheme;
      delete document.body.dataset.colorScheme;
    } else {
      document.documentElement.dataset.colorScheme = colorScheme;
      document.body.dataset.colorScheme = colorScheme;
    }
    localStorage.setItem("textodon.colorScheme", colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    document.documentElement.dataset.sectionSize = sectionSize;
    localStorage.setItem("textodon.sectionSize", sectionSize);
  }, [sectionSize]);

  useEffect(() => {
    try {
      if (composeAccountId) {
        localStorage.setItem(COMPOSE_ACCOUNT_KEY, composeAccountId);
      } else {
        localStorage.removeItem(COMPOSE_ACCOUNT_KEY);
      }
    } catch {
      /* noop */
    }
  }, [composeAccountId]);

  useEffect(() => {
    localStorage.setItem("textodon.profileImages", showProfileImages ? "on" : "off");
  }, [showProfileImages]);

  useEffect(() => {
    localStorage.setItem("textodon.customEmojis", showCustomEmojis ? "on" : "off");
  }, [showCustomEmojis]);

  useEffect(() => {
    localStorage.setItem("textodon.reactions", showMisskeyReactions ? "on" : "off");
  }, [showMisskeyReactions]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    setMobileComposeOpen(false);
  }, []);

  const handleClearLocalStorage = useCallback(() => {
    const confirmed = window.confirm(
      "로컬 저장소의 모든 데이터를 삭제할까요? 계정과 설정 정보가 모두 초기화됩니다."
    );
    if (!confirmed) {
      return;
    }
    try {
      localStorage.clear();
    } catch {
      /* noop */
    }
    window.location.reload();
  }, []);

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    const element =
      target instanceof Element
        ? target
        : target && "parentElement" in target
          ? (target as Node).parentElement
          : null;
    if (!element) {
      return false;
    }
    return Boolean(
      element.closest(
        "button, a, input, textarea, select, label, summary, details, [role='button'], [contenteditable='true'], [data-interactive='true']"
      )
    );
  }, []);

  const handleBoardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !timelineBoardRef.current) {
        return;
      }
      if (isInteractiveTarget(event.target)) {
        return;
      }
      dragStateRef.current = {
        startX: event.clientX,
        scrollLeft: timelineBoardRef.current.scrollLeft,
        pointerId: event.pointerId
      };
      setIsBoardDragging(true);
      timelineBoardRef.current.setPointerCapture(event.pointerId);
    },
    [isInteractiveTarget]
  );

  const handleBoardPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineBoardRef.current || !dragStateRef.current) {
      return;
    }
    if (event.pointerId !== dragStateRef.current.pointerId) {
      return;
    }
    const delta = event.clientX - dragStateRef.current.startX;
    timelineBoardRef.current.scrollLeft = dragStateRef.current.scrollLeft - delta;
    event.preventDefault();
  }, []);

  const handleBoardPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineBoardRef.current || !dragStateRef.current) {
      return;
    }
    if (event.pointerId !== dragStateRef.current.pointerId) {
      return;
    }
    timelineBoardRef.current.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
    setIsBoardDragging(false);
  }, []);

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

  useEffect(() => {
    const currentIds = new Set(accountsState.accounts.map((account) => account.id));
    const addedAccounts = accountsState.accounts.filter(
      (account) => !previousAccountIds.current.has(account.id)
    );
    if (addedAccounts.length > 0) {
      setSections((current) => {
        const next = [...current];
        addedAccounts.forEach((account) => {
          if (!next.some((section) => section.accountId === account.id)) {
            next.push({ id: crypto.randomUUID(), accountId: account.id });
          }
        });
        return next;
      });
    }
    previousAccountIds.current = currentIds;
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

  const composeAccountSelector = (
    <AccountSelector
      accounts={accountsState.accounts}
      activeAccountId={composeAccountId}
      setActiveAccount={setComposeAccountId}
      removeAccount={accountsState.removeAccount}
      variant="inline"
    />
  );

  const addSectionAt = (index: number) => {
    const defaultAccountId = composeAccountId ?? accountsState.accounts[0]?.id ?? null;
    setSections((current) => {
      const next = [...current];
      const insertIndex = Math.max(0, Math.min(index, next.length));
      next.splice(insertIndex, 0, { id: crypto.randomUUID(), accountId: defaultAccountId });
      return next;
    });
    if (!composeAccountId && defaultAccountId) {
      setComposeAccountId(defaultAccountId);
    }
  };

  const addSectionNear = (sectionId: string, direction: "left" | "right") => {
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      addSectionAt(sections.length);
      return;
    }
    addSectionAt(direction === "left" ? index : index + 1);
  };

  const moveSection = (sectionId: string, direction: "left" | "right") => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      if (index === -1) {
        return current;
      }
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const removeSection = (sectionId: string) => {
    setSections((current) => current.filter((section) => section.id !== sectionId));
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
        <a href="#/" className="app-logo" aria-label="Deck 홈">
          <img src={logoUrl} alt="Deck logo" />
        </a>
        <div className="app-header-actions">
          <button
            type="button"
            className="icon-button mobile-compose-button"
            aria-label="글쓰기 열기"
            onClick={() => setMobileComposeOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4z" />
              <path d="M14 6l4 4" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-button mobile-menu-button"
            aria-label="메뉴 열기"
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <main className="layout">
        <aside>
          <div className="compose-panel">
            {composeAccount ? (
              <ComposeBox
                accountSelector={composeAccountSelector}
                account={composeAccount}
                api={services.api}
                onSubmit={handleSubmit}
                replyingTo={replyTarget ? { id: replyTarget.id, summary: replySummary ?? "" } : null}
                onCancelReply={() => {
                  setReplyTarget(null);
                  setMentionSeed(null);
                }}
                mentionText={mentionSeed}
              />
            ) : null}
          </div>
          {route === "home" ? (
            <section className="panel sidebar-panel">
              <div className="brand">
                <img src={logoUrl} alt="Deck logo" />
                <div className="brand-text">
                  <h1>Deck</h1>
                  <p>오픈소스 페디버스 웹 클라이언트</p>
                </div>
              </div>
              <p className="sidebar-description">
                여러 계정을 전환하고 타임라인을 실시간으로 확인할 수 있습니다.
              </p>
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="settings-button button-with-icon"
                  onClick={() => setSettingsOpen(true)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16" />
                    <circle cx="9" cy="6" r="2" />
                    <path d="M4 12h16" />
                    <circle cx="15" cy="12" r="2" />
                    <path d="M4 18h16" />
                    <circle cx="8" cy="18" r="2" />
                  </svg>
                  설정 열기
                </button>
                <AccountAdd
                  accounts={accountsState.accounts}
                  setActiveAccount={accountsState.setActiveAccount}
                  oauth={services.oauth}
                />
              </div>
              <div className="sidebar-divider" role="presentation" />
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
        </aside>

        <section className="main-column">
          {oauthLoading ? <p className="empty">OAuth 인증 중...</p> : null}
          {actionError ? <p className="error">{actionError}</p> : null}
          {route === "home" ? (
            <section className="panel">
            {sections.length > 0 ? (
              <div
                className={`timeline-board${isBoardDragging ? " is-dragging" : ""}`}
                ref={timelineBoardRef}
                onPointerDown={handleBoardPointerDown}
                onPointerMove={handleBoardPointerMove}
                  onPointerUp={handleBoardPointerUp}
                  onPointerLeave={handleBoardPointerUp}
                  onPointerCancel={handleBoardPointerUp}
                >
                  {sections.map((section, index) => {
                    const sectionAccount =
                      section.accountId
                        ? accountsState.accounts.find((account) => account.id === section.accountId) ?? null
                        : null;
                    const shouldShowReactions = showMisskeyReactions;
                    return (
                      <TimelineSection
                        key={section.id}
                        section={section}
                        account={sectionAccount}
                        services={services}
                        accountsState={accountsState}
                        onAccountChange={setSectionAccount}
                        onAddSectionLeft={(id) => addSectionNear(id, "left")}
                        onAddSectionRight={(id) => addSectionNear(id, "right")}
                        onRemoveSection={removeSection}
                        onReply={handleReply}
                        onError={(message) => setActionError(message || null)}
                        onMoveSection={moveSection}
                        canMoveLeft={index > 0}
                        canMoveRight={index < sections.length - 1}
                        canRemoveSection={sections.length > 1}
                        showProfileImage={showProfileImages}
                        showCustomEmojis={showCustomEmojis}
                        showReactions={shouldShowReactions}
                        registerTimelineListener={registerTimelineListener}
                        unregisterTimelineListener={unregisterTimelineListener}
                      />
                    );
                  })}
                </div>
              ) : null}
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

      {mobileComposeOpen ? (
        <div className="mobile-menu">
          <div className="mobile-menu-backdrop" onClick={() => setMobileComposeOpen(false)} />
          <div className="mobile-menu-panel panel">
            <div className="mobile-menu-header">
              <h3>글쓰기</h3>
              <button
                type="button"
                className="ghost"
                onClick={() => setMobileComposeOpen(false)}
                aria-label="글쓰기 닫기"
              >
                닫기
              </button>
            </div>
            {composeAccount ? (
              <ComposeBox
                accountSelector={composeAccountSelector}
                account={composeAccount}
                api={services.api}
                onSubmit={handleSubmit}
                replyingTo={replyTarget ? { id: replyTarget.id, summary: replySummary ?? "" } : null}
                onCancelReply={() => {
                  setReplyTarget(null);
                  setMentionSeed(null);
                }}
                mentionText={mentionSeed}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {mobileMenuOpen ? (
        <div className="mobile-menu">
          <div className="mobile-menu-backdrop" onClick={closeMobileMenu} />
          <div className="mobile-menu-panel panel">
            <div className="mobile-menu-header">
              <h3>메뉴</h3>
              <button type="button" className="ghost" onClick={closeMobileMenu} aria-label="메뉴 닫기">
                닫기
              </button>
            </div>
            <div className="mobile-menu-actions">
              <button
                type="button"
                className="button-with-icon"
                onClick={() => {
                  setSettingsOpen(true);
                  closeMobileMenu();
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16" />
                  <circle cx="9" cy="6" r="2" />
                  <path d="M4 12h16" />
                  <circle cx="15" cy="12" r="2" />
                  <path d="M4 18h16" />
                  <circle cx="8" cy="18" r="2" />
                </svg>
                설정 열기
              </button>
            </div>
            <div className="mobile-menu-section">
              <AccountAdd
                accounts={accountsState.accounts}
                setActiveAccount={accountsState.setActiveAccount}
                oauth={services.oauth}
              />
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="settings-modal">
          <div className="settings-modal-backdrop" onClick={() => setSettingsOpen(false)} />
          <div className="settings-modal-content panel">
            <div className="settings-modal-header">
              <h3>설정</h3>
              <button
                type="button"
                className="settings-close"
                onClick={() => setSettingsOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="settings-item">
              <div>
                <strong>테마</strong>
                <p>기본, 크리스마스, 하늘핑크, 모노톤 테마를 선택합니다.</p>
              </div>
              <select
                value={themeMode}
                onChange={(event) => {
                  const nextTheme = event.target.value;
                  if (isThemeMode(nextTheme)) {
                    setThemeMode(nextTheme);
                  }
                }}
                aria-label="테마 선택"
              >
                <option value="default">기본</option>
                <option value="christmas">크리스마스</option>
                <option value="sky-pink">하늘핑크</option>
                <option value="monochrome">모노톤</option>
              </select>
            </div>
            <div className="settings-item">
              <div>
                <strong>색상 모드</strong>
                <p>시스템 설정을 따르거나 라이트/다크 모드를 고정합니다.</p>
              </div>
              <select
                value={colorScheme}
                onChange={(event) => {
                  const nextScheme = event.target.value;
                  if (isColorScheme(nextScheme)) {
                    setColorScheme(nextScheme);
                  }
                }}
                aria-label="색상 모드 선택"
              >
                <option value="system">시스템</option>
                <option value="light">라이트</option>
                <option value="dark">다크</option>
              </select>
            </div>
            <div className="settings-item">
              <div>
                <strong>프로필 이미지 표시</strong>
                <p>피드에서 사용자 프로필 이미지를 보여줍니다.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showProfileImages}
                  onChange={(event) => setShowProfileImages(event.target.checked)}
                />
                <span className="slider" aria-hidden="true" />
              </label>
            </div>
            <div className="settings-item">
              <div>
                <strong>커스텀 이모지 표시</strong>
                <p>사용자 이름과 본문에 커스텀 이모지를 표시합니다.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showCustomEmojis}
                  onChange={(event) => setShowCustomEmojis(event.target.checked)}
                />
                <span className="slider" aria-hidden="true" />
              </label>
            </div>
            <div className="settings-item">
              <div>
                <strong>리액션 표시</strong>
                <p>리액션 정보를 지원하는 서버에서 받은 리액션을 보여줍니다.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showMisskeyReactions}
                  onChange={(event) => setShowMisskeyReactions(event.target.checked)}
                />
                <span className="slider" aria-hidden="true" />
              </label>
            </div>
            <div className="settings-item">
              <div>
                <strong>섹션 폭</strong>
                <p>타임라인 섹션의 가로 폭을 조절합니다.</p>
              </div>
              <select
                value={sectionSize}
                onChange={(event) =>
                  setSectionSize(event.target.value as "small" | "medium" | "large")
                }
              >
                <option value="small">소</option>
                <option value="medium">중</option>
                <option value="large">대</option>
              </select>
            </div>
            <div className="settings-item">
              <div>
                <strong>로컬 저장소 초기화</strong>
                <p>계정과 설정을 포함한 모든 로컬 데이터를 삭제합니다.</p>
              </div>
              <button
                type="button"
                className="settings-danger-button"
                onClick={handleClearLocalStorage}
                aria-label="로컬 저장소 초기화"
              >
                모두 삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
