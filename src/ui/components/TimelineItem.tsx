import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, CustomEmoji, ReactionInput, Status } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { useAppContext } from "../state/AppContext";
import { sanitizeHtml } from "../utils/htmlSanitizer";
import { renderMfm, isMfmText } from "../utils/mfm";
import boostIconUrl from "../assets/boost-icon.svg";
import replyIconUrl from "../assets/reply-icon.svg";
import trashIconUrl from "../assets/trash-icon.svg";
import { ReactionPicker } from "./ReactionPicker";
import { useClickOutside } from "../hooks/useClickOutside";
import { useImageZoom } from "../hooks/useImageZoom";
import { AccountLabel } from "./AccountLabel";

export const TimelineItem = ({
  status,
  onReply,
  onToggleFavourite,
  onToggleReblog,
  onDelete,
  onReact,
  onStatusClick,
  account,
  api,
  activeHandle,
  activeAccountHandle,
  activeAccountUrl,
  disableActions = false,
  enableReactionActions = true
}: {
  status: Status;
  onReply: (status: Status) => void;
  onToggleFavourite: (status: Status) => void;
  onToggleReblog: (status: Status) => void;
  onDelete: (status: Status) => void;
  onReact?: (status: Status, reaction: ReactionInput) => void;
  onStatusClick?: (status: Status) => void;
  account: Account | null;
  api: MastodonApi;
  activeHandle: string;
  activeAccountHandle: string;
  activeAccountUrl: string | null;
  disableActions?: boolean;
  enableReactionActions?: boolean;
}) => {
  const { services, accountsState } = useAppContext();
  const { showCustomEmojis, showReactions, showProfileImages, enableMfmAnimations } = accountsState.preferences;
  const notification = status.notification;
  const displayStatus = notification?.target ?? status.reblog ?? status;
  const boostedBy = notification ? null : status.reblog ? status.boostedBy : null;
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [showContent, setShowContent] = useState(() => displayStatus.spoilerText.length === 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // useImageZoom 훅 사용
  const {
    zoom: imageZoom,
    offset: imageOffset,
    isDragging,
    handleWheel,
    handleImageLoad,
    handlePointerDown,
    reset: resetImageZoom
  } = useImageZoom(imageContainerRef, imageRef);
  const attachments = displayStatus.mediaAttachments;
  const activeImageUrl = activeImageIndex !== null ? attachments[activeImageIndex]?.url ?? null : null;

  const goToPrevImage = useCallback(() => {
    if (activeImageIndex === null || attachments.length <= 1) return;
    const prevIndex = activeImageIndex === 0 ? attachments.length - 1 : activeImageIndex - 1;
    setActiveImageIndex(prevIndex);
    resetImageZoom();
  }, [activeImageIndex, attachments.length, resetImageZoom]);

  const goToNextImage = useCallback(() => {
    if (activeImageIndex === null || attachments.length <= 1) return;
    const nextIndex = activeImageIndex === attachments.length - 1 ? 0 : activeImageIndex + 1;
    setActiveImageIndex(nextIndex);
    resetImageZoom();
  }, [activeImageIndex, attachments.length, resetImageZoom]);

  useEffect(() => {
    if (activeImageIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevImage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextImage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setActiveImageIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageIndex, goToPrevImage, goToNextImage]);

  const previewCard = displayStatus.card;
  const mentionNames = useMemo(() => {
    if (!displayStatus.mentions || displayStatus.mentions.length === 0) {
      return "";
    }
    return displayStatus.mentions
      .map((mention) => mention.displayName || mention.handle)
      .filter(Boolean)
      .join(", ");
  }, [displayStatus.mentions]);
  const displayHandle = useMemo(() => {
    if (displayStatus.accountHandle.includes("@")) {
      return displayStatus.accountHandle;
    }
    if (!displayStatus.accountUrl) {
      return displayStatus.accountHandle;
    }
    try {
      const host = new URL(displayStatus.accountUrl).hostname;
      return `${displayStatus.accountHandle}@${host}`;
    } catch {
      return displayStatus.accountHandle;
    }
  }, [displayStatus.accountHandle, displayStatus.accountUrl]);
  const boostedHandle = useMemo(() => {
    if (!boostedBy) {
      return null;
    }
    if (boostedBy.handle.includes("@")) {
      return boostedBy.handle;
    }
    if (!boostedBy.url) {
      return boostedBy.handle;
    }
    try {
      const host = new URL(boostedBy.url).hostname;
      return `${boostedBy.handle}@${host}`;
    } catch {
      return boostedBy.handle;
    }
  }, [boostedBy]);
  const boostedLabel = useMemo(() => {
    if (notification) {
      return null;
    }
    if (boostedBy) {
      const label = boostedBy.name || boostedHandle || boostedBy.handle;
      return `${label} 님이 부스트함`;
    }
    if (displayStatus.reblogged) {
      return "내가 부스트함";
    }
    return null;
  }, [boostedBy, boostedHandle, displayStatus.reblogged, activeHandle, notification]);
  const notificationActorHandle = useMemo(() => {
    if (!notification) {
      return "";
    }
    const handle = notification.actor.handle;
    if (!handle) {
      return "";
    }
    if (handle.includes("@")) {
      return handle;
    }
    if (!notification.actor.url) {
      return handle;
    }
    try {
      const host = new URL(notification.actor.url).hostname;
      return `${handle}@${host}`;
    } catch {
      return handle;
    }
  }, [notification]);
  const notificationLabel = useMemo(() => {
    if (!notification) {
      return null;
    }
    const actorName =
      notification.actor.name || notificationActorHandle || notification.actor.handle || "알 수 없음";
    return `${actorName} 님이 ${notification.label}`;
  }, [notification, notificationActorHandle]);
  const timestamp = useMemo(
    () => new Date(displayStatus.createdAt).toLocaleString(),
    [displayStatus.createdAt]
  );
  const originUrl = useMemo(() => {
    if (displayStatus.url) {
      return displayStatus.url;
    }
    const hostFromAccount = activeAccountUrl
      ? (() => {
          try {
            return new URL(activeAccountUrl).hostname;
          } catch {
            return "";
          }
        })()
      : "";
    const hostFromHandle = activeHandle.includes("@")
      ? activeHandle.split("@").pop() ?? ""
      : "";
    const host = hostFromAccount || hostFromHandle;
    if (!host || !displayStatus.id) {
      return null;
    }
    return `https://${host}/notes/${displayStatus.id}`;
  }, [activeAccountUrl, activeHandle, displayStatus.id, displayStatus.url]);
  const handleHeaderClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!displayStatus.accountUrl) {
        return;
      }
      const target =
        event.target instanceof Element
          ? event.target
          : event.target && "parentElement" in event.target
            ? (event.target as Node).parentElement
            : null;
      if (target?.closest("a")) {
        return;
      }
      window.open(displayStatus.accountUrl, "_blank", "noopener,noreferrer");
    },
    [displayStatus.accountUrl]
  );
  const handleHeaderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!displayStatus.accountUrl) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      window.open(displayStatus.accountUrl, "_blank", "noopener,noreferrer");
    },
    [displayStatus.accountUrl]
  );

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const handleOpenOrigin = useCallback(() => {
    if (!originUrl) {
      return;
    }
    window.open(originUrl, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }, [originUrl]);

  const handleStatusClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onStatusClick) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("a")) {
        return;
      }
      onStatusClick(displayStatus);
    },
    [displayStatus, onStatusClick]
  );
  const visibilityIcon = useMemo(() => {
    switch (displayStatus.visibility) {
      case "public":
        return (
          <svg className="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 0 0 18" />
            <path d="M12 3a14 14 0 0 1 0 18" />
          </svg>
        );
      case "private":
        return (
          <svg className="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        );
      case "direct":
        return (
          <svg className="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7l9 6 9-6" />
            <rect x="3" y="6" width="18" height="12" rx="2" />
          </svg>
        );
      default:
        return null;
    }
  }, [displayStatus.visibility]);

  const formatReactionLabel = useCallback((reaction: Status["reactions"][number]) => {
    const baseName =
      reaction.name.startsWith(":") && reaction.name.endsWith(":")
        ? reaction.name.slice(1, -1)
        : reaction.name;
    const trimmed = baseName.replace(/@\.?$/, "");
    if (!reaction.isCustom) {
      return trimmed || reaction.name;
    }
    if (trimmed.includes("@") || !reaction.host) {
      return trimmed || reaction.name;
    }
    return `${trimmed}@${reaction.host}`;
  }, []);
  const buildEmojiMap = useCallback((emojis: CustomEmoji[]) => {
    return new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));
  }, []);

  const tokenizeWithEmojis = useCallback((text: string, emojiMap: Map<string, string>) => {
    const regex = /:([a-zA-Z0-9_]+):/g;
    const tokens: Array<{ type: "text"; value: string } | { type: "emoji"; name: string; url: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const shortcode = match[1];
      const url = emojiMap.get(shortcode);
      if (match.index > lastIndex) {
        tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      if (url) {
        tokens.push({ type: "emoji", name: shortcode, url });
      } else {
        tokens.push({ type: "text", value: match[0] });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      tokens.push({ type: "text", value: text.slice(lastIndex) });
    }
    return tokens;
  }, []);

  const renderTextWithLinks = useCallback((text: string, keyPrefix: string) => {
    const regex = /(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]]*)?)(?=[^\w@]|$)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const url = match[0];
      // Skip email addresses
      if (url.includes('@')) {
        parts.push(url);
      } else {
        const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
        parts.push(
          <a key={`${keyPrefix}-link-${key}`} href={normalizedUrl} target="_blank" rel="noreferrer">
            {url}
          </a>
        );
      }
      key += 1;
      lastIndex = match.index + url.length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  }, []);

  const contentParts = useMemo(() => {
    const text = displayStatus.content;
    
    // Check if this is a Misskey instance and the content contains MFM syntax
    if (account?.platform === "misskey" && isMfmText(text)) {
      const mfmHtml = renderMfm(text, displayStatus.customEmojis, {
        enableAnimation: enableMfmAnimations,
        enableEmoji: showCustomEmojis,
      });
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: mfmHtml }}
          className="mfm-content rich-content"
        />
      );
    }
    
    // Check if content actually contains HTML tags before rendering as HTML
    const hasHtmlTags = displayStatus.htmlContent ? /<[^>]+>/g.test(displayStatus.htmlContent) : false;
    
    if (displayStatus.hasRichContent && hasHtmlTags) {
      // Process HTML content to ensure custom emojis are properly rendered
      let processedHtml = displayStatus.htmlContent || '';
      
      // If custom emojis should be shown and we have emoji data, replace any remaining shortcodes
      if (showCustomEmojis && displayStatus.customEmojis.length > 0) {
        const emojiMap = buildEmojiMap(displayStatus.customEmojis);
        
        // Replace any remaining :shortcode: patterns that weren't converted to <img> tags
        processedHtml = processedHtml.replace(/:([a-zA-Z0-9_]+):/g, (match, shortcode) => {
          const url = emojiMap.get(shortcode);
          if (url) {
            return `<img src="${url}" alt=":${shortcode}:" class="custom-emoji" loading="lazy" />`;
          }
          return match; // Keep original if no emoji found
        });
      }
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedHtml) }}
          className="rich-content"
        />
      );
    }
    
    // Fallback to plain text with link detection
    if (!showCustomEmojis || displayStatus.customEmojis.length === 0) {
      return renderTextWithLinks(text, "content");
    }
    const emojiMap = buildEmojiMap(displayStatus.customEmojis);
    const tokens = tokenizeWithEmojis(text, emojiMap);
    const parts: React.ReactNode[] = [];
    tokens.forEach((token, index) => {
      if (token.type === "text") {
        parts.push(...renderTextWithLinks(token.value, `content-${index}`));
      } else {
        parts.push(
          <img
            key={`content-emoji-${index}`}
            src={token.url}
            alt={`:${token.name}:`}
            className="custom-emoji"
            loading="lazy"
          />
        );
      }
    });
    return parts;
  }, [
    buildEmojiMap,
    displayStatus.content,
    displayStatus.customEmojis,
    displayStatus.htmlContent,
    displayStatus.hasRichContent,
    renderTextWithLinks,
    showCustomEmojis,
    tokenizeWithEmojis
  ]);

  const accountLabel = displayStatus.accountName || displayStatus.accountHandle;
  const accountNameNode = useMemo(() => {
    if (!showCustomEmojis || displayStatus.accountEmojis.length === 0) {
      return accountLabel;
    }
    const emojiMap = buildEmojiMap(displayStatus.accountEmojis);
    const tokens = tokenizeWithEmojis(accountLabel, emojiMap);
    return tokens.map((token, index) => {
      if (token.type === "text") {
        return token.value;
      }
      return (
        <img
          key={`account-emoji-${index}`}
          src={token.url}
          alt={`:${token.name}:`}
          className="custom-emoji"
          loading="lazy"
        />
      );
    });
  }, [
    accountLabel,
    buildEmojiMap,
    displayStatus.accountEmojis,
    showCustomEmojis,
    tokenizeWithEmojis
  ]);

  const normalizeHandle = useCallback((handle: string, url: string | null) => {
    if (!handle) {
      return "";
    }
    if (handle.includes("@")) {
      return handle;
    }
    if (!url) {
      return handle;
    }
    try {
      const host = new URL(url).hostname;
      return `${handle}@${host}`;
    } catch {
      return handle;
    }
  }, []);
  const normalizedActiveHandle = useMemo(
    () => normalizeHandle(activeAccountHandle, activeAccountUrl),
    [activeAccountHandle, activeAccountUrl, normalizeHandle]
  );
  const normalizedStatusHandle = useMemo(
    () => normalizeHandle(displayStatus.accountHandle, displayStatus.accountUrl),
    [displayStatus.accountHandle, displayStatus.accountUrl, normalizeHandle]
  );
  const isSameAccount = useMemo(() => {
    if (!normalizedActiveHandle || !normalizedStatusHandle) {
      return false;
    }
    if (normalizedActiveHandle === normalizedStatusHandle) {
      return true;
    }
    if (
      !normalizedStatusHandle.includes("@") &&
      normalizedActiveHandle.startsWith(`${normalizedStatusHandle}@`)
    ) {
      return true;
    }
    if (
      !normalizedActiveHandle.includes("@") &&
      normalizedStatusHandle.startsWith(`${normalizedActiveHandle}@`)
    ) {
      return true;
    }
    return false;
  }, [normalizedActiveHandle, normalizedStatusHandle]);
  const canDelete = isSameAccount;
  const isOwnStatus = isSameAccount;
  const boostDisabled =
    !displayStatus.reblogged && (isOwnStatus || displayStatus.visibility === "private" || displayStatus.visibility === "direct");
  const shouldShowReactions = showReactions && displayStatus.reactions.length > 0;
  const actionsEnabled = !disableActions;
  const canReact =
    Boolean(onReact) &&
    enableReactionActions &&
    actionsEnabled &&
    showReactions &&
    account?.platform === "misskey";
  const hasAttachmentButtons = showContent && attachments.length > 0;
  const shouldRenderFooter = actionsEnabled || hasAttachmentButtons;

  useEffect(() => {
    setShowContent(displayStatus.spoilerText.length === 0);
  }, [displayStatus.spoilerText]);

  useEffect(() => {
    if (!activeImageUrl) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeImageUrl]);


  const handleReactionSelect = useCallback(
    (reaction: ReactionInput) => {
      if (!canReact || !onReact) {
        return;
      }
      onReact(displayStatus, reaction);
    },
    [canReact, displayStatus, onReact]
  );

  return (
    <article className="status">
      {notificationLabel ? (
        <div className="notification-actor">
          <span className="status-avatar notification-actor-avatar" aria-hidden="true">
            {notification?.actor.avatarUrl ? (
              <img src={notification.actor.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span className="status-avatar-fallback" aria-hidden="true" />
            )}
          </span>
          <span>{notificationLabel}</span>
        </div>
      ) : null}
      {boostedLabel ? (
        <div className="boosted-by">
          <img src={boostIconUrl} alt="" aria-hidden="true" />
          <span>{boostedLabel}</span>
        </div>
      ) : null}
      {mentionNames ? (
        <div className="reply-info">
          <img src={replyIconUrl} alt="" aria-hidden="true" />
          <span>{mentionNames}에게 보낸 답글</span>
        </div>
      ) : null}
      <header className="status-header-main">
        <div className="status-header-info">
          {showProfileImages ? (
            <span
              className="status-avatar"
              onClick={handleHeaderClick}
              onKeyDown={handleHeaderKeyDown}
              role={displayStatus.accountUrl ? "link" : undefined}
              tabIndex={displayStatus.accountUrl ? 0 : undefined}
              aria-label={
                displayStatus.accountUrl
                  ? `${displayStatus.accountName || displayStatus.accountHandle} 프로필 열기`
                  : undefined
              }
              data-interactive={displayStatus.accountUrl ? "true" : undefined}
            >
              {displayStatus.accountAvatarUrl ? (
                <img
                  src={displayStatus.accountAvatarUrl}
                  alt={`${displayStatus.accountName || displayStatus.accountHandle} 프로필 이미지`}
                  loading="lazy"
                />
              ) : (
                <span className="status-avatar-fallback" aria-hidden="true" />
              )}
            </span>
          ) : null}
          <div
            className="status-account"
            onClick={handleHeaderClick}
            onKeyDown={handleHeaderKeyDown}
            role={displayStatus.accountUrl ? "link" : undefined}
            tabIndex={displayStatus.accountUrl ? 0 : undefined}
            aria-label={
              displayStatus.accountUrl
                ? `${displayStatus.accountName || displayStatus.accountHandle} 프로필 열기`
                : undefined
            }
            data-interactive={displayStatus.accountUrl ? "true" : undefined}
          >
            <strong>
              {displayStatus.accountUrl ? (
                <a href={displayStatus.accountUrl} target="_blank" rel="noreferrer">
                  {accountNameNode}
                </a>
              ) : (
                accountNameNode
              )}
            </strong>
            <span>
              {displayStatus.accountUrl ? (
                <a href={displayStatus.accountUrl} target="_blank" rel="noreferrer">
                  @{displayHandle}
                </a>
              ) : (
                `@${displayHandle}`
              )}
            </span>
          </div>
        </div>
        <div className="status-menu section-menu">
          <button
            type="button"
            className="icon-button"
            aria-label="게시글 메뉴 열기"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
          {menuOpen ? (
            <>
              <div className="overlay-backdrop" aria-hidden="true" />
              <div ref={menuRef} className="section-menu-panel status-menu-panel" role="menu">
                <button type="button" onClick={handleOpenOrigin} disabled={!originUrl}>
                  원본 서버에서 보기
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>
      {displayStatus.spoilerText ? (
        <div className="status-warning">
          <p className="status-warning-text">{displayStatus.spoilerText}</p>
          <button type="button" className="text-link" onClick={() => setShowContent((prev) => !prev)}>
            {showContent ? "가리기" : "내용보기"}
          </button>
        </div>
      ) : null}
      {showContent ? (
        <>
          <p className="status-text">{displayStatus.content ? contentParts : "(내용 없음)"}</p>
          {previewCard ? (
        <a
          className={`link-preview${previewCard.image ? "" : " no-image"}`}
          href={previewCard.url}
          target="_blank"
          rel="noreferrer"
        >
          {previewCard.image ? (
            <img src={previewCard.image} alt="" loading="lazy" />
          ) : null}
          <div className="link-preview-body">
            <strong>{previewCard.title}</strong>
            {previewCard.description ? <span>{previewCard.description}</span> : null}
            <span className="link-preview-url">{previewCard.url}</span>
          </div>
        </a>
          ) : null}
        </>
      ) : null}
      <div 
        className="status-time"
        onClick={handleStatusClick}
        role={onStatusClick ? "button" : undefined}
        tabIndex={onStatusClick ? 0 : undefined}
        aria-label={onStatusClick ? "글 보기" : undefined}
        data-interactive={onStatusClick ? "true" : undefined}
      >
        {visibilityIcon}
        {visibilityIcon ? <span className="time-separator" aria-hidden="true">·</span> : null}
        <time dateTime={displayStatus.createdAt}>{timestamp}</time>
      </div>
      {shouldShowReactions ? (
        <div className="status-reactions" aria-label="받은 리액션">
          {displayStatus.reactions.map((reaction) => {
            const label = formatReactionLabel(reaction);
            const isMine = displayStatus.myReaction === reaction.name;
            return (
              <button
                key={reaction.name}
                type="button"
                className={`status-reaction${isMine ? " is-active" : ""}`}
                title={`${label} ${reaction.count}회`}
                aria-label={`${label} 리액션 ${isMine ? "취소" : "추가"}`}
                onClick={() =>
                  handleReactionSelect({
                    name: reaction.name,
                    url: reaction.url,
                    isCustom: reaction.isCustom,
                    host: reaction.host
                  })
                }
                disabled={!canReact}
              >
                {reaction.url ? (
                  <img
                    src={reaction.url}
                    alt={`${label} 이모지`}
                    className="status-reaction-emoji"
                    loading="lazy"
                  />
                ) : (
                  <span className="status-reaction-emoji" aria-hidden="true">
                    {label}
                  </span>
                )}
                <span className="status-reaction-count">{reaction.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {shouldRenderFooter ? (
        <footer>
          <div className="status-actions">
            {actionsEnabled ? (
              <>
                <button type="button" onClick={() => onReply(displayStatus)}>
                  답글
                </button>
                {account?.platform !== "misskey" ? (
                  <button
                    type="button"
                    className={displayStatus.favourited ? "is-active" : undefined}
                    onClick={() => onToggleFavourite(displayStatus)}
                  >
                    {displayStatus.favourited ? "좋아요 취소" : "좋아요"}
                    {displayStatus.favouritesCount > 0 ? ` (${displayStatus.favouritesCount})` : ""}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={displayStatus.reblogged ? "is-active" : undefined}
                  onClick={() => onToggleReblog(displayStatus)}
                  disabled={boostDisabled}
                  title={boostDisabled ? "내 글은 부스트할 수 없습니다." : undefined}
                >
                  {displayStatus.reblogged ? "부스트 취소" : "부스트"}
                  {displayStatus.reblogsCount > 0 ? ` (${displayStatus.reblogsCount})` : ""}
                </button>
                {canReact ? (
                  <ReactionPicker
                    account={account}
                    api={api}
                    onSelect={handleReactionSelect}
                    disabled={Boolean(displayStatus.myReaction)}
                  />
                ) : null}
              </>
            ) : null}
            {showContent
              ? attachments.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="attachment-thumb"
                    onClick={() => {
                      resetImageZoom();
                      setActiveImageIndex(index);
                    }}
                    aria-label={item.description ? `이미지 보기: ${item.description}` : "이미지 보기"}
                  >
                    <img src={item.url} alt={item.description ?? "첨부 이미지"} loading="lazy" />
                  </button>
                ))
              : null}
          </div>
          {actionsEnabled && canDelete ? (
            <button type="button" className="delete-button" onClick={() => setShowDeleteConfirm(true)}>
              <img src={trashIconUrl} alt="" aria-hidden="true" />
            </button>
          ) : null}
        </footer>
      ) : null}
      {showDeleteConfirm ? (
        <div className="confirm-modal" role="dialog" aria-modal="true">
          <div className="image-modal-backdrop" onClick={() => setShowDeleteConfirm(false)} />
          <div className="confirm-modal-content">
            <h3>게시글 삭제</h3>
            <div className="status confirm-status">
              <header className="status-header">
                <AccountLabel
                  avatarUrl={displayStatus.accountAvatarUrl}
                  displayName={displayStatus.accountName}
                  name={displayStatus.accountHandle}
                  handle={displayHandle}
                  avatarClassName="status-avatar"
                  avatarFallbackClassName="status-avatar-fallback"
                  textAsDiv={true}
                  boldName={true}
                  className=""
                />
              </header>
              <p className="status-text confirm-text">
                {displayStatus.content || "(내용 없음)"}
              </p>
              <time dateTime={displayStatus.createdAt} className="status-time">
                {timestamp}
              </time>
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="delete-button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(displayStatus);
                }}
              >
                삭제
              </button>
              <button type="button" onClick={() => setShowDeleteConfirm(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeImageUrl ? (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          onWheel={(event) => event.preventDefault()}
          onMouseDown={(event) => {
            if (!(event.target instanceof Element)) {
              return;
            }
            if (!event.target.closest(".image-modal-content")) {
              setActiveImageIndex(null);
            }
          }}
        >
          <div className="image-modal-backdrop" onClick={() => setActiveImageIndex(null)} />
          <div
            className="image-modal-content"
            ref={imageContainerRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveImageIndex(null);
              }
            }}
          >
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setActiveImageIndex(null)}
            >
              닫기
            </button>
            {attachments.length > 1 ? (
              <button
                type="button"
                className="image-modal-nav image-modal-nav-prev"
                onClick={goToPrevImage}
                aria-label="이전 이미지"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            {attachments.length > 1 ? (
              <button
                type="button"
                className="image-modal-nav image-modal-nav-next"
                onClick={goToNextImage}
                aria-label="다음 이미지"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            <img
              src={activeImageUrl}
              alt="첨부 이미지 원본"
              ref={imageRef}
              draggable={false}
              className={isDragging ? "is-dragging" : undefined}
              style={{
                transform: `scale(${imageZoom}) translate(${imageOffset.x / imageZoom}px, ${imageOffset.y / imageZoom}px)`
              }}
              onWheel={handleWheel}
              onLoad={handleImageLoad}
              onPointerDown={handlePointerDown}
            />
            {attachments.length > 1 ? (
              <div className="image-modal-counter">
                {(activeImageIndex ?? 0) + 1} / {attachments.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
};
