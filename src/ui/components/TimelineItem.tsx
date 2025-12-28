import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomEmoji, Status } from "../../domain/types";
import boostIconUrl from "../assets/boost-icon.svg";
import replyIconUrl from "../assets/reply-icon.svg";
import trashIconUrl from "../assets/trash-icon.svg";

export const TimelineItem = ({
  status,
  onReply,
  onToggleFavourite,
  onToggleReblog,
  onDelete,
  activeHandle,
  activeAccountHandle,
  activeAccountUrl,
  showProfileImage,
  showCustomEmojis
}: {
  status: Status;
  onReply: (status: Status) => void;
  onToggleFavourite: (status: Status) => void;
  onToggleReblog: (status: Status) => void;
  onDelete: (status: Status) => void;
  activeHandle: string;
  activeAccountHandle: string;
  activeAccountUrl: string | null;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
}) => {
  const displayStatus = status.reblog ?? status;
  const boostedBy = status.reblog ? status.boostedBy : null;
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(() => displayStatus.spoilerText.length === 0);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const attachments = displayStatus.mediaAttachments;
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
    if (boostedBy) {
      const label = boostedBy.name || boostedHandle || boostedBy.handle;
      return `${label} 님이 부스트함(@${boostedHandle ?? boostedBy.handle})`;
    }
    if (displayStatus.reblogged) {
      return activeHandle ? `내가 부스트함(@${activeHandle})` : "내가 부스트함";
    }
    return null;
  }, [boostedBy, boostedHandle, displayStatus.reblogged, activeHandle]);
  const timestamp = useMemo(
    () => new Date(displayStatus.createdAt).toLocaleString(),
    [displayStatus.createdAt]
  );
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
  const buildEmojiMap = useCallback((emojis: CustomEmoji[]) => {
    return new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));
  }, []);

  const tokenizeWithEmojis = useCallback((text: string, emojiMap: Map<string, string>) => {
    const regex = /:([a-zA-Z0-9_+-]+):/g;
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
    const regex = /(https?:\/\/[^\s)\]]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const url = match[0];
      parts.push(
        <a key={`${keyPrefix}-link-${key}`} href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      );
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

  const clampOffset = useCallback(
    (next: { x: number; y: number }, zoom: number) => {
      if (!baseSize || !imageContainerRef.current) {
        return next;
      }
      const container = imageContainerRef.current.getBoundingClientRect();
      const maxX = Math.max(0, (baseSize.width * zoom - container.width) / 2);
      const maxY = Math.max(0, (baseSize.height * zoom - container.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y))
      };
    },
    [baseSize]
  );

  useEffect(() => {
    setImageOffset((current) => clampOffset(current, imageZoom));
  }, [imageZoom, clampOffset]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current) {
        return;
      }
      const dx = event.clientX - dragStateRef.current.startX;
      const dy = event.clientY - dragStateRef.current.startY;
      const next = {
        x: dragStateRef.current.originX + dx,
        y: dragStateRef.current.originY + dy
      };
      setImageOffset(clampOffset(next, imageZoom));
    };
    const handleUp = () => {
      setIsDragging(false);
      dragStateRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [clampOffset, imageZoom, isDragging]);

  return (
    <article className="status">
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
        {showProfileImage ? (
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
      <div className="status-time">
        {visibilityIcon}
        {visibilityIcon ? <span className="time-separator" aria-hidden="true">·</span> : null}
        {displayStatus.url ? (
          <a href={displayStatus.url} target="_blank" rel="noreferrer" className="time-link">
            <time dateTime={displayStatus.createdAt}>{timestamp}</time>
          </a>
        ) : (
          <time dateTime={displayStatus.createdAt}>{timestamp}</time>
        )}
      </div>
      <footer>
        <div className="status-actions">
          <button type="button" onClick={() => onReply(displayStatus)}>
            답글
          </button>
          <button
            type="button"
            className={displayStatus.favourited ? "is-active" : undefined}
            onClick={() => onToggleFavourite(displayStatus)}
          >
            {displayStatus.favourited ? "좋아요 취소" : "좋아요"}
            {displayStatus.favouritesCount > 0 ? ` (${displayStatus.favouritesCount})` : ""}
          </button>
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
          {showContent
            ? attachments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="attachment-thumb"
                  onClick={() => {
                    setImageZoom(1);
                    setImageOffset({ x: 0, y: 0 });
                    setActiveImageUrl(item.url);
                  }}
                  aria-label={item.description ? `이미지 보기: ${item.description}` : "이미지 보기"}
                >
                  <img src={item.url} alt={item.description ?? "첨부 이미지"} loading="lazy" />
                </button>
              ))
            : null}
        </div>
        {canDelete ? (
          <button type="button" className="delete-button" onClick={() => setShowDeleteConfirm(true)}>
            <img src={trashIconUrl} alt="" aria-hidden="true" />
          </button>
        ) : null}
      </footer>
      {showDeleteConfirm ? (
        <div className="confirm-modal" role="dialog" aria-modal="true">
          <div className="image-modal-backdrop" onClick={() => setShowDeleteConfirm(false)} />
          <div className="confirm-modal-content">
            <h3>게시글 삭제</h3>
            <div className="status confirm-status">
              <header className="status-header">
                {displayStatus.accountAvatarUrl ? (
                  <span className="status-avatar" aria-hidden="true">
                    <img src={displayStatus.accountAvatarUrl} alt="" loading="lazy" />
                  </span>
                ) : (
                  <span className="status-avatar" aria-hidden="true">
                    <span className="status-avatar-fallback" />
                  </span>
                )}
                <div>
                  <strong>{displayStatus.accountName || displayStatus.accountHandle}</strong>
                  <span>@{displayHandle}</span>
                </div>
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
        >
          <div className="image-modal-backdrop" onClick={() => setActiveImageUrl(null)} />
          <div className="image-modal-content" ref={imageContainerRef}>
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setActiveImageUrl(null)}
            >
              닫기
            </button>
            <img
              src={activeImageUrl}
              alt="첨부 이미지 원본"
              ref={imageRef}
              draggable={false}
              className={isDragging ? "is-dragging" : undefined}
              style={{
                transform: `scale(${imageZoom}) translate(${imageOffset.x / imageZoom}px, ${imageOffset.y / imageZoom}px)`
              }}
              onWheel={(event) => {
                event.preventDefault();
                const delta = event.deltaY > 0 ? -0.1 : 0.1;
                setImageZoom((current) => Math.min(3, Math.max(0.6, current + delta)));
              }}
              onLoad={() => {
                setImageZoom(1);
                setImageOffset({ x: 0, y: 0 });
                requestAnimationFrame(() => {
                  if (!imageRef.current) {
                    return;
                  }
                  const rect = imageRef.current.getBoundingClientRect();
                  setBaseSize({ width: rect.width, height: rect.height });
                });
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                event.preventDefault();
                dragStateRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: imageOffset.x,
                  originY: imageOffset.y
                };
                setIsDragging(true);
              }}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
};







