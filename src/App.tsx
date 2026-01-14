import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Reaction, ReactionInput, Status, TimelineType } from "./domain/types";
import { AccountAdd } from "./ui/components/AccountAdd";
import { AccountSelector } from "./ui/components/AccountSelector";
import { ComposeBox } from "./ui/components/ComposeBox";
import { ProfileModal } from "./ui/components/ProfileModal";
import { StatusModal } from "./ui/components/StatusModal";
import { TimelineItem } from "./ui/components/TimelineItem";
import { useTimeline } from "./ui/hooks/useTimeline";
import { useClickOutside } from "./ui/hooks/useClickOutside";
import { useAppContext } from "./ui/state/AppContext";
import type { AccountsState, AppServices } from "./ui/state/AppContext";
import { createAccountId, formatHandle, normalizeInstanceUrl } from "./ui/utils/account";
import { clearPendingOAuth, createOauthState, loadPendingOAuth, loadRegisteredApp, saveRegisteredApp, storePendingOAuth } from "./ui/utils/oauth";
import { getTimelineLabel, getTimelineOptions, normalizeTimelineType } from "./ui/utils/timeline";
import { sanitizeHtml } from "./ui/utils/htmlSanitizer";
import { renderMarkdown } from "./ui/utils/markdown";
import { useToast } from "./ui/state/ToastContext";
import logoUrl from "./ui/assets/textodon-icon-blue.png";
import licenseText from "../LICENSE?raw";
import ossMarkdown from "./ui/content/oss.md?raw";
import termsMarkdown from "./ui/content/terms.md?raw";

type Route = "home" | "terms" | "license" | "oss";
type InfoModalType = "terms" | "license" | "oss";
type TimelineSectionConfig = { id: string; accountId: string | null; timelineType: TimelineType };
type ProfileTarget = { status: Status; account: Account | null; zIndex: number };

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

const sortReactions = (reactions: Reaction[]) =>
  [...reactions].sort((a, b) => {
    if (a.count === b.count) {
      return a.name.localeCompare(b.name);
    }
    return b.count - a.count;
  });

const buildReactionSignature = (reactions: Reaction[]) =>
  sortReactions(reactions).map((reaction) =>
    [reaction.name, reaction.count, reaction.url ?? "", reaction.isCustom ? "1" : "0", reaction.host ?? ""].join("|")
  );

const hasSameReactions = (left: Status, right: Status) => {
  if (left.myReaction !== right.myReaction) {
    return false;
  }
  const leftSig = buildReactionSignature(left.reactions);
  const rightSig = buildReactionSignature(right.reactions);
  if (leftSig.length !== rightSig.length) {
    return false;
  }
  return leftSig.every((value, index) => value === rightSig[index]);
};

const adjustReactionCount = (
  reactions: Reaction[],
  name: string,
  delta: number,
  fallback?: ReactionInput
) => {
  let updated = false;
  const next = reactions
    .map((reaction) => {
      if (reaction.name !== name) {
        return reaction;
      }
      updated = true;
      const count = reaction.count + delta;
      if (count <= 0) {
        return null;
      }
      return { ...reaction, count };
    })
    .filter((reaction): reaction is Reaction => reaction !== null);

  if (!updated && delta > 0 && fallback) {
    next.push({ ...fallback, count: delta });
  }

  return next;
};

const buildOptimisticReactionStatus = (
  status: Status,
  reaction: ReactionInput,
  remove: boolean
): Status => {
  let nextReactions = status.reactions;
  if (remove) {
    nextReactions = adjustReactionCount(nextReactions, reaction.name, -1);
  } else {
    if (status.myReaction && status.myReaction !== reaction.name) {
      nextReactions = adjustReactionCount(nextReactions, status.myReaction, -1);
    }
    nextReactions = adjustReactionCount(nextReactions, reaction.name, 1, reaction);
  }
  const sorted = sortReactions(nextReactions);
  const favouritesCount = sorted.reduce((sum, item) => sum + item.count, 0);
  const myReaction = remove ? null : reaction.name;
  return {
    ...status,
    reactions: sorted,
    myReaction,
    favouritesCount,
    favourited: Boolean(myReaction)
  };
};

const TimelineIcon = ({ timeline }: { timeline: TimelineType }) => {
  switch (timeline) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "local":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
          <path d="M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
      );
    case "federated":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M9 12h6" />
          <path d="M12 6v3" />
          <path d="M12 15v3" />
        </svg>
      );
    case "social":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="9" r="3" />
          <circle cx="16" cy="9" r="3" />
          <path d="M4 20c0-3 2.5-5 4-5h0" />
          <path d="M20 20c0-3-2.5-5-4-5h0" />
        </svg>
      );
    case "global":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18" />
          <path d="M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    default:
      return null;
  }
};

const termsHtml = sanitizeHtml(renderMarkdown(termsMarkdown));
const ossHtml = sanitizeHtml(renderMarkdown(ossMarkdown));

const TermsContent = () => (
  <div className="info-markdown" dangerouslySetInnerHTML={{ __html: termsHtml }} />
);

const LicenseContent = () => <pre className="license">{licenseText}</pre>;

const OssContent = () => (
  <div className="info-markdown" dangerouslySetInnerHTML={{ __html: ossHtml }} />
);

const getInfoModalTitle = (type: InfoModalType) => {
  switch (type) {
    case "terms":
      return "이용약관";
    case "license":
      return "라이선스";
    case "oss":
      return "오픈소스 목록";
    default:
      return "";
  }
};

const InfoModalContent = ({ type }: { type: InfoModalType }) => {
  switch (type) {
    case "terms":
      return <TermsContent />;
    case "license":
      return <LicenseContent />;
    case "oss":
      return <OssContent />;
    default:
      return null;
  }
};

const InfoModal = ({ type, onClose }: { type: InfoModalType; onClose: () => void }) => {
  const title = getInfoModalTitle(type);
  return (
    <div className="info-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="info-modal-backdrop" onClick={onClose} />
      <div className="info-modal-content">
        <div className="info-modal-header">
          <h3 className="info-modal-title">{title}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label={`${title} 닫기`}>
            닫기
          </button>
        </div>
        <div className="info-modal-body">
          <InfoModalContent type={type} />
        </div>
      </div>
    </div>
  );
};

const TermsPage = () => (
  <section className="panel info-panel">
    <PageHeader title="이용약관" />
    <TermsContent />
  </section>
);

const LicensePage = () => (
  <section className="panel info-panel">
    <PageHeader title="라이선스" />
    <LicenseContent />
  </section>
);

const OssPage = () => (
  <section className="panel info-panel">
    <PageHeader title="오픈소스 목록" />
    <OssContent />
  </section>
);

const TimelineSection = ({
  section,
  account,
  services,
  accountsState,
  onAccountChange,
  onTimelineChange,
  onAddSectionLeft,
  onAddSectionRight,
  onRemoveSection,
  onReply,
  onStatusClick,
  onCloseStatusModal,
  onReact,
  onProfileClick,
  onError,
  onMoveSection,
  onScrollToSection,
  canMoveLeft,
  canMoveRight,
  canRemoveSection,
  timelineType,
  showProfileImage,
  showCustomEmojis,
  showReactions,
  registerTimelineListener,
  unregisterTimelineListener,
  columnRef
}: {
  section: TimelineSectionConfig;
  account: Account | null;
  services: AppServices;
  accountsState: AccountsState;
  onAccountChange: (sectionId: string, accountId: string | null) => void;
  onTimelineChange: (sectionId: string, timelineType: TimelineType) => void;
  onAddSectionLeft: (sectionId: string) => void;
  onAddSectionRight: (sectionId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onReply: (status: Status, account: Account | null) => void;
  onStatusClick: (status: Status, columnAccount: Account | null) => void;
  onReact: (account: Account | null, status: Status, reaction: ReactionInput) => void;
  onProfileClick: (status: Status, account: Account | null) => void;
  onError: (message: string | null) => void;
  columnAccount: Account | null;
  onMoveSection: (sectionId: string, direction: "left" | "right") => void;
  onScrollToSection: (sectionId: string) => void;
  onCloseStatusModal: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canRemoveSection: boolean;
  timelineType: TimelineType;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
  showReactions: boolean;
  registerTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
  unregisterTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
  columnRef?: React.Ref<HTMLDivElement>;
}) => {
  const notificationsTimeline = useTimeline({
    account,
    api: services.api,
    streaming: services.streaming,
    timelineType: "notifications",
    enableStreaming: false
  });
  const {
    items: notificationItems,
    loading: notificationsLoading,
    loadingMore: notificationsLoadingMore,
    error: notificationsError,
    refresh: refreshNotifications,
    loadMore: loadMoreNotifications
  } = notificationsTimeline;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const timelineMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const notificationScrollRef = useRef<HTMLDivElement | null>(null);
  const lastNotificationToastRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [timelineMenuOpen, setTimelineMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const { showToast } = useToast();
  const timelineOptions = useMemo(() => getTimelineOptions(account?.platform, false), [account?.platform]);
  const timelineButtonLabel = `타임라인 선택: ${getTimelineLabel(timelineType)}`;
  const hasNotificationBadge = notificationCount > 0;
  const instanceOriginUrl = useMemo(() => {
    if (!account) {
      return null;
    }
    try {
      return normalizeInstanceUrl(account.instanceUrl);
    } catch {
      return null;
    }
  }, [account]);
  const notificationBadgeLabel = notificationsOpen
    ? "알림 닫기"
    : hasNotificationBadge
      ? `알림 열기 (새 알림 ${notificationCount >= 99 ? "99개 이상" : `${notificationCount}개`})`
      : "알림 열기";
  const notificationBadgeText = notificationCount >= 99 ? "99+" : String(notificationCount);
  const handleNotification = useCallback(() => {
    if (notificationsOpen) {
      refreshNotifications();
      return;
    }
    setNotificationCount((count) => Math.min(count + 1, 99));
    if (timelineType === "notifications") {
      return;
    }
    const now = Date.now();
    if (now - lastNotificationToastRef.current < 5000) {
      return;
    }
    lastNotificationToastRef.current = now;
    showToast("새 알림이 도착했습니다.", {
      tone: "info",
      actionLabel: "알림 받은 컬럼으로 이동",
      actionAriaLabel: "알림이 도착한 컬럼으로 이동",
      onAction: () => onScrollToSection(section.id)
    });
  }, [notificationsOpen, refreshNotifications, timelineType, showToast, onScrollToSection, section.id]);
  const timeline = useTimeline({
    account,
    api: services.api,
    streaming: services.streaming,
    timelineType,
    onNotification: handleNotification
  });
  const actionsDisabled = timelineType === "notifications";
  const emptyMessage = timelineType === "notifications" ? "표시할 알림이 없습니다." : "표시할 글이 없습니다.";

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
    if (!account || timelineType === "notifications") {
      return;
    }
    registerTimelineListener(account.id, timeline.updateItem);
    return () => {
      unregisterTimelineListener(account.id, timeline.updateItem);
    };
  }, [account, registerTimelineListener, timeline.updateItem, timelineType, unregisterTimelineListener]);

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  useClickOutside(timelineMenuRef, timelineMenuOpen, () => setTimelineMenuOpen(false));

  useClickOutside(notificationMenuRef, notificationsOpen, () => setNotificationsOpen(false));

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }
    const el = notificationScrollRef.current;
    if (!el) {
      return;
    }
      const onScroll = () => {
        const threshold = el.scrollHeight - el.clientHeight - 120;
        if (el.scrollTop >= threshold) {
          loadMoreNotifications();
        }
      };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [notificationsOpen, loadMoreNotifications]);

  useEffect(() => {
    if (!account) {
      setNotificationsOpen(false);
      setTimelineMenuOpen(false);
    }
    setNotificationCount(0);
  }, [account?.id]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }
    setNotificationCount(0);
    refreshNotifications();
  }, [notificationsOpen, refreshNotifications]);

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

  const handleReact = useCallback(
    (status: Status, reaction: ReactionInput) => {
      onReact(account, status, reaction);
    },
    [account, onReact]
  );

  const handleDeleteStatus = async (status: Status) => {
    if (!account) {
      return;
    }
    onError(null);
    try {
      await services.api.deleteStatus(account, status.id);
      timeline.removeItem(status.id);
      onCloseStatusModal();
    } catch (err) {
      onError(err instanceof Error ? err.message : "게시글 삭제에 실패했습니다.");
    }
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleOpenInstanceOrigin = useCallback(() => {
    if (!instanceOriginUrl) {
      return;
    }
    window.open(instanceOriginUrl, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }, [instanceOriginUrl]);

  return (
    <div className="timeline-column" ref={columnRef}>
      <div className="timeline-column-header">
        <AccountSelector
          accounts={accountsState.accounts}
          activeAccountId={account?.id ?? null}
          setActiveAccount={(id) => {
            onAccountChange(section.id, id);
            accountsState.setActiveAccount(id);
          }}
          variant="inline"
        />
        <div className="timeline-column-actions" role="group" aria-label="타임라인 작업">
          <div className="timeline-selector">
            <button
              type="button"
              className="timeline-selector-button"
              onClick={() => {
                if (!account) {
                  onError("계정을 선택해주세요.");
                  return;
                }
                setTimelineMenuOpen((current) => !current);
                setMenuOpen(false);
                setNotificationsOpen(false);
              }}
              disabled={!account}
              aria-label={timelineButtonLabel}
              aria-haspopup="menu"
              aria-expanded={timelineMenuOpen}
              title={timelineButtonLabel}
            >
              <TimelineIcon timeline={timelineType} />
              <span className="timeline-selector-label">{getTimelineLabel(timelineType)}</span>
            </button>
            {timelineMenuOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div
                  ref={timelineMenuRef}
                  className="section-menu-panel timeline-selector-panel"
                  role="menu"
                  aria-label="타임라인 선택"
                >
                  {timelineOptions.map((option) => {
                    const isSelected = timelineType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={isSelected ? "is-active" : ""}
                        aria-pressed={isSelected}
                        onClick={() => {
                          onTimelineChange(section.id, option.id);
                          setTimelineMenuOpen(false);
                        }}
                      >
                        <TimelineIcon timeline={option.id} />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          <div className="notification-menu">
            <button
              type="button"
              className={`icon-button${notificationsOpen ? " is-active" : ""}`}
              onClick={() => {
                if (!account) {
                  onError("계정을 선택해주세요.");
                  return;
                }
                setMenuOpen(false);
                setTimelineMenuOpen(false);
                setNotificationsOpen((current) => !current);
              }}
              disabled={!account}
              aria-label={notificationBadgeLabel}
              aria-pressed={notificationsOpen}
              title={notificationBadgeLabel}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {hasNotificationBadge ? (
                <span className="notification-badge" aria-hidden="true">
                  {notificationBadgeText}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div ref={notificationMenuRef} className="notification-popover panel" role="dialog" aria-modal="true" aria-label="알림">
                  <div className="notification-popover-body" ref={notificationScrollRef}>
                    {notificationsError ? <p className="error">{notificationsError}</p> : null}
                    {notificationItems.length === 0 && !notificationsLoading ? (
                      <p className="empty">표시할 알림이 없습니다.</p>
                    ) : null}
                    {notificationsLoading && notificationItems.length === 0 ? (
                      <p className="empty">알림을 불러오는 중...</p>
                    ) : null}
                    {notificationItems.length > 0 ? (
                      <div className="timeline">
                        {notificationItems.map((status) => (
                          <TimelineItem
                            key={status.id}
                            status={status}
                             onReply={(item) => onReply(item, account)}
                             onStatusClick={(status) => onStatusClick(status, account)}
                             onToggleFavourite={handleToggleFavourite}
                            onToggleReblog={handleToggleReblog}
                            onDelete={handleDeleteStatus}
                            onReact={handleReact}
                            onProfileClick={(item) => onProfileClick(item, account)}
                            activeHandle={
                              account?.handle ? formatHandle(account.handle, account.instanceUrl) : account?.instanceUrl ?? ""
                            }
                            activeAccountHandle={account?.handle ?? ""}
                            activeAccountUrl={account?.url ?? null}
                            account={account}
                            api={services.api}
                            showProfileImage={showProfileImage}
                            showCustomEmojis={showCustomEmojis}
                            showReactions={showReactions}
                            disableActions
                          />
                        ))}
                      </div>
                    ) : null}
                    {notificationsLoadingMore ? <p className="empty">더 불러오는 중...</p> : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="section-menu">
            <button
              type="button"
              className="icon-button menu-button"
              aria-label="섹션 메뉴 열기"
              onClick={() => {
                setMenuOpen((current) => !current);
                setNotificationsOpen(false);
                setTimelineMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>
            {menuOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div ref={menuRef} className="section-menu-panel" role="menu">
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
                  <button
                    type="button"
                    onClick={handleOpenInstanceOrigin}
                    disabled={!instanceOriginUrl}
                  >
                    원본 서버에서 보기
                  </button>
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
        </div>
      </div>
      <div className="timeline-column-body" ref={scrollRef}>
        {!account ? <p className="empty">계정을 선택하면 타임라인을 불러옵니다.</p> : null}
        {account && timeline.error ? <p className="error">{timeline.error}</p> : null}
        {account && timeline.items.length === 0 && !timeline.loading ? (
          <p className="empty">{emptyMessage}</p>
        ) : null}
        {account && timeline.items.length > 0 ? (
          <div className="timeline">
            {timeline.items.map((status) => (
              <TimelineItem
                key={status.id}
                status={status}
                 onReply={(item) => onReply(item, account)}
                 onStatusClick={(status) => onStatusClick(status, account)}
                 onToggleFavourite={handleToggleFavourite}
                onToggleReblog={handleToggleReblog}
                onDelete={handleDeleteStatus}
                onReact={handleReact}
                onProfileClick={(item) => onProfileClick(item, account)}
                activeHandle={
                  account.handle ? formatHandle(account.handle, account.instanceUrl) : account.instanceUrl
                }
                activeAccountHandle={account.handle ?? ""}
                activeAccountUrl={account.url ?? null}
                account={account}
                api={services.api}
                showProfileImage={showProfileImage}
                showCustomEmojis={showCustomEmojis}
                showReactions={showReactions}
                disableActions={actionsDisabled}
              />
            ))}
          </div>
        ) : null}
        {timeline.loadingMore ? <p className="empty">더 불러오는 중...</p> : null}
      </div>
      <button
        type="button"
        className="icon-button scroll-top-fab"
        onClick={scrollToTop}
        disabled={isAtTop}
        aria-label="최상단으로 이동"
        title="최상단으로 이동"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
};

type ThemeMode = "default" | "christmas" | "sky-pink" | "monochrome" | "matcha-core";

const isThemeMode = (value: string): value is ThemeMode =>
  value === "default" ||
  value === "christmas" ||
  value === "sky-pink" ||
  value === "monochrome" ||
  value === "matcha-core";

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
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalType | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileComposeOpen, setMobileComposeOpen] = useState(false);
  const { services, accountsState } = useAppContext();
  const [sections, setSections] = useState<TimelineSectionConfig[]>(() => {
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Partial<TimelineSectionConfig>>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: item.id || crypto.randomUUID(),
            accountId: item.accountId ?? null,
            timelineType: normalizeTimelineType(
              item.timelineType ?? "home",
              item.accountId
                ? accountsState.accounts.find((account) => account.id === item.accountId)?.platform ?? null
                : null,
              false
            )
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
        accountId: accountsState.activeAccountId ?? accountsState.accounts[0]?.id ?? null,
        timelineType: "home"
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
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [profileTargets, setProfileTargets] = useState<ProfileTarget[]>([]);
  const [statusModalZIndex, setStatusModalZIndex] = useState<number | null>(null);
  const nextModalZIndexRef = useRef(70);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mentionSeed, setMentionSeed] = useState<string | null>(null);
  const timelineBoardRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const dragStateRef = useRef<{ startX: number; scrollLeft: number; pointerId: number } | null>(null);
  const [isBoardDragging, setIsBoardDragging] = useState(false);
  const replySummary = replyTarget
    ? `@${replyTarget.accountHandle} · ${replyTarget.content.slice(0, 80)}`
    : null;
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const timelineListeners = useRef<Map<string, Set<(status: Status) => void>>>(new Map());
  const previousAccountIds = useRef<Set<string>>(new Set());
  const hasAccounts = accountsState.accounts.length > 0;

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

  const updateStatusEverywhere = useCallback(
    (accountId: string, status: Status) => {
      broadcastStatusUpdate(accountId, status);
      setSelectedStatus((current) => (current && current.id === status.id ? status : current));
    },
    [broadcastStatusUpdate]
  );

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
            id: pending.accountId ?? createAccountId(),
            instanceUrl: pending.instanceUrl,
            accessToken,
            platform: pending.platform,
            name: "",
            displayName: "",
            handle: "",
            url: null,
            avatarUrl: null,
            emojis: []
          };
          const verified = await services.api.verifyAccount(draft);
          const fullHandle = formatHandle(verified.handle, pending.instanceUrl);
          const displayName = verified.accountName || fullHandle;
          if (pending.accountId) {
            const existing = accountsState.accounts.find((account) => account.id === pending.accountId);
            if (!existing) {
              setActionError("재인증할 계정을 찾지 못했습니다.");
              return;
            }
            const updated: Account = {
              ...existing,
              instanceUrl: pending.instanceUrl,
              accessToken,
              platform: pending.platform,
              name: `${displayName} @${fullHandle}`,
              displayName,
              handle: fullHandle,
              avatarUrl: verified.avatarUrl,
              emojis: verified.emojis ?? []
            };
            accountsState.updateAccount(existing.id, updated);
            accountsState.setActiveAccount(existing.id);
            return;
          }
          const existing = accountsState.accounts.find(
            (account) =>
              account.platform === pending.platform &&
              account.instanceUrl === pending.instanceUrl &&
              account.handle === fullHandle
          );
          if (existing) {
            setActionError("이미 등록된 계정입니다.");
            accountsState.setActiveAccount(existing.id);
            return;
          }
          accountsState.addAccount({
            ...draft,
            name: `${displayName} @${fullHandle}`,
            displayName,
            handle: fullHandle,
            avatarUrl: verified.avatarUrl,
            emojis: verified.emojis ?? []
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

  const handleSettingsReauth = useCallback(async () => {
    const account = accountsState.accounts.find((a) => a.id === settingsAccountId);
    if (!account) return;
    setReauthLoading(true);
    try {
      const normalizedUrl = normalizeInstanceUrl(account.instanceUrl);
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      const redirectUri = url.toString();
      const cached = loadRegisteredApp(normalizedUrl);
      const needsRegister = !cached || cached.redirectUri !== redirectUri || cached.platform === "misskey";
      const registered = needsRegister ? await services.oauth.registerApp(normalizedUrl, redirectUri) : cached;
      if (!registered) {
        throw new Error("앱 등록 정보를 불러오지 못했습니다.");
      }
      if (needsRegister && registered.platform === "mastodon") {
        saveRegisteredApp(registered);
      }
      const state = createOauthState();
      storePendingOAuth({ ...registered, state, accountId: account.id });
      const authorizeUrl = services.oauth.buildAuthorizeUrl(registered, state);
      window.location.assign(authorizeUrl);
    } catch {
      setReauthLoading(false);
    }
  }, [accountsState.accounts, settingsAccountId, services.oauth]);

  const handleSettingsRemove = useCallback(() => {
    if (!settingsAccountId) return;
    const confirmed = window.confirm("이 계정을 삭제할까요?");
    if (confirmed) {
      accountsState.removeAccount(settingsAccountId);
      setSettingsAccountId(null);
    }
  }, [settingsAccountId, accountsState]);

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

  const scrollToSection = useCallback((sectionId: string) => {
    const target = sectionRefs.current.get(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  useEffect(() => {
    setSections((current) =>
      current.map((section) => {
        const account = section.accountId
          ? accountsState.accounts.find((item) => item.id === section.accountId) ?? null
          : null;
        if (!account) {
          return {
            ...section,
            accountId: null,
            timelineType: normalizeTimelineType(section.timelineType, null, false)
          };
        }
        const normalizedTimeline = normalizeTimelineType(section.timelineType, account.platform, false);
        if (normalizedTimeline === section.timelineType) {
          return section;
        }
        return { ...section, timelineType: normalizedTimeline };
      })
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
            next.push({ id: crypto.randomUUID(), accountId: account.id, timelineType: "home" });
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
    spoilerText: string;
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
        mediaIds,
        spoilerText: params.spoilerText
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
    setSelectedStatus(null);
  };

  const handleStatusClick = (status: Status, columnAccount: Account | null) => {
    setSelectedStatus(status);
    setStatusModalZIndex(nextModalZIndexRef.current++);
    // Status에 columnAccount 정보를 임시 저장
    (status as any).__columnAccount = columnAccount;
  };

  const handleProfileOpen = useCallback((target: Status, columnAccount: Account | null) => {
    const zIndex = nextModalZIndexRef.current++;
    setProfileTargets((current) => [...current, { status: target, account: columnAccount, zIndex }]);
  }, []);

  const handleCloseProfileModal = useCallback((index?: number) => {
    setProfileTargets((current) => {
      if (current.length === 0) {
        return current;
      }
      if (typeof index !== "number") {
        return current.slice(0, -1);
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const handleCloseStatusModal = () => {
    setSelectedStatus(null);
    setStatusModalZIndex(null);
  };

  const handleReaction = useCallback(
    async (account: Account | null, status: Status, reaction: ReactionInput) => {
      if (!account) {
        setActionError("계정을 선택해주세요.");
        return;
      }
      if (account.platform !== "misskey") {
        setActionError("리액션은 미스키 계정에서만 사용할 수 있습니다.");
        return;
      }
      if (status.myReaction && status.myReaction !== reaction.name) {
        setActionError("이미 리액션을 남겼습니다. 먼저 취소해주세요.");
        return;
      }
      setActionError(null);
      const isRemoving = status.myReaction === reaction.name;
      const optimistic = buildOptimisticReactionStatus(status, reaction, isRemoving);
      updateStatusEverywhere(account.id, optimistic);
      try {
      const updated = isRemoving
          ? await services.api.deleteReaction(account, status.id)
          : await services.api.createReaction(account, status.id, reaction.name);
        if (!hasSameReactions(updated, optimistic)) {
          updateStatusEverywhere(account.id, updated);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "리액션 처리에 실패했습니다.");
        updateStatusEverywhere(account.id, status);
      }
    },
    [services.api, updateStatusEverywhere]
  );

  const composeAccountSelector = (
    <AccountSelector
      accounts={accountsState.accounts}
      activeAccountId={composeAccountId}
      setActiveAccount={setComposeAccountId}
      variant="inline"
    />
  );

  const addSectionAt = (index: number) => {
    const defaultAccountId = composeAccountId ?? accountsState.accounts[0]?.id ?? null;
    setSections((current) => {
      const next = [...current];
      const insertIndex = Math.max(0, Math.min(index, next.length));
      next.splice(insertIndex, 0, {
        id: crypto.randomUUID(),
        accountId: defaultAccountId,
        timelineType: "home"
      });
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
    const nextAccount = accountId
      ? accountsState.accounts.find((account) => account.id === accountId) ?? null
      : null;
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              accountId,
              timelineType: normalizeTimelineType(section.timelineType, nextAccount?.platform ?? null, false)
            }
          : section
      )
    );
  };

  const setSectionTimeline = (sectionId: string, timelineType: TimelineType) => {
    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }
        const account = section.accountId
          ? accountsState.accounts.find((item) => item.id === section.accountId) ?? null
          : null;
        return {
          ...section,
          timelineType: normalizeTimelineType(timelineType, account?.platform ?? null, false)
        };
      })
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

      <main className={`layout${hasAccounts ? "" : " layout-empty"}`}>
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
                  oauth={services.oauth}
                />
              </div>
              <div className="sidebar-divider" role="presentation" />
              <nav className="sidebar-links">
                <a
                  href="#/terms"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("terms");
                  }}
                >
                  이용약관
                </a>
                <a
                  href="#/license"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("license");
                  }}
                >
                  라이선스
                </a>
                <a
                  href="#/oss"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("oss");
                  }}
                >
                  오픈소스 목록
                </a>
                <a href="https://github.com/deholic/textodon" target="_blank" rel="noreferrer">
                  소스 코드
                </a>
              </nav>
            </section>
          ) : null}
        </aside>

        {hasAccounts ? (
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
                          onTimelineChange={setSectionTimeline}
                          onScrollToSection={scrollToSection}
                          onAddSectionLeft={(id) => addSectionNear(id, "left")}
                           onAddSectionRight={(id) => addSectionNear(id, "right")}
                           onRemoveSection={removeSection}
                          onReply={handleReply}
                           onStatusClick={handleStatusClick}
                           onReact={handleReaction}
                           onProfileClick={handleProfileOpen}
                           columnAccount={sectionAccount}
                          columnRef={(node) => {
                            if (node) {
                              sectionRefs.current.set(section.id, node);
                            } else {
                              sectionRefs.current.delete(section.id);
                            }
                          }}
                           onCloseStatusModal={handleCloseStatusModal}
                           onError={(message) => setActionError(message || null)}
                          onMoveSection={moveSection}
                          canMoveLeft={index > 0}
                          canMoveRight={index < sections.length - 1}
                          canRemoveSection={sections.length > 1}
                          timelineType={section.timelineType}
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
              </section>
            ) : null}
            {route === "terms" ? <TermsPage /> : null}
            {route === "license" ? <LicensePage /> : null}
            {route === "oss" ? <OssPage /> : null}
          </section>
        ) : null}
      </main>

      {infoModal ? (
        <InfoModal type={infoModal} onClose={() => setInfoModal(null)} />
      ) : null}

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
            <div className="settings-item settings-item-account">
              <div>
                <strong>계정 관리</strong>
                <p>계정을 선택하여 재인증하거나 삭제합니다.</p>
              </div>
              <div className="settings-account-actions">
                <AccountSelector
                  accounts={accountsState.accounts}
                  activeAccountId={settingsAccountId}
                  setActiveAccount={setSettingsAccountId}
                  variant="inline"
                />
                <div className="settings-account-buttons">
                  <button
                    type="button"
                    onClick={handleSettingsReauth}
                    disabled={!settingsAccountId || reauthLoading}
                    aria-label="계정 재인증"
                  >
                    {reauthLoading ? "재인증 중..." : "재인증"}
                  </button>
                  <button
                    type="button"
                    className="settings-danger-button"
                    onClick={handleSettingsRemove}
                    disabled={!settingsAccountId}
                    aria-label="계정 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
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
                <option value="matcha-core">말차코어</option>
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
      
      {profileTargets.map((target, index) => (
        <ProfileModal
          key={`${target.status.id}-${index}`}
          status={target.status}
          account={target.account}
          api={services.api}
          zIndex={target.zIndex}
          isTopmost={index === profileTargets.length - 1}
          onClose={() => handleCloseProfileModal(index)}
          onReply={handleReply}
          onStatusClick={(status) => handleStatusClick(status, target.account)}
          onProfileClick={handleProfileOpen}
          showProfileImage={showProfileImages}
          showCustomEmojis={showCustomEmojis}
          showReactions={showMisskeyReactions}
        />
      ))}

      {selectedStatus ? (
        <StatusModal
          status={selectedStatus}
          account={composeAccount}
          threadAccount={(selectedStatus as any).__columnAccount || null}
          api={services.api}
          zIndex={statusModalZIndex ?? undefined}
          onClose={handleCloseStatusModal}
          onProfileClick={handleProfileOpen}
          onReply={(status) => {
            if (composeAccount) {
              handleReply(status, composeAccount);
            }
          }}
          onToggleFavourite={async (status) => {
            if (!composeAccount) {
              setActionError("계정을 선택해주세요.");
              return;
            }
            setActionError(null);
            try {
              const updated = status.favourited
                ? await services.api.unfavourite(composeAccount, status.id)
                : await services.api.favourite(composeAccount, status.id);
              // Update the status in modal
              setSelectedStatus(updated);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "좋아요 처리에 실패했습니다.");
            }
          }}
          onToggleReblog={async (status) => {
            if (!composeAccount) {
              setActionError("계정을 선택해주세요.");
              return;
            }
            setActionError(null);
            try {
              const updated = status.reblogged
                ? await services.api.unreblog(composeAccount, status.id)
                : await services.api.reblog(composeAccount, status.id);
              setSelectedStatus(updated);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "부스트 처리에 실패했습니다.");
            }
          }}
          onDelete={async (status) => {
            if (!composeAccount) {
              return;
            }
            setActionError(null);
            try {
              await services.api.deleteStatus(composeAccount, status.id);
              setSelectedStatus(null);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "게시글 삭제에 실패했습니다.");
            }
          }}
          activeHandle={
            composeAccount?.handle ? formatHandle(composeAccount.handle, composeAccount.instanceUrl) : composeAccount?.instanceUrl ?? ""
          }
          activeAccountHandle={composeAccount?.handle ?? ""}
          activeAccountUrl={composeAccount?.url ?? null}
          showProfileImage={showProfileImages}
          showCustomEmojis={showCustomEmojis}
          showReactions={showMisskeyReactions}
        />
      ) : null}
    </div>
  );
};
