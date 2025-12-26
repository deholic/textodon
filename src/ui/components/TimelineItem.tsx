import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Status } from "../../domain/types";
import boostIconUrl from "../assets/boost-icon.svg";
import replyIconUrl from "../assets/reply-icon.svg";
import trashIconUrl from "../assets/trash-icon.svg";

export const TimelineItem = ({
  status,
  onReply,
  onToggleFavourite,
  onToggleReblog,
  onDelete,
  activeHandle
}: {
  status: Status;
  onReply: (status: Status) => void;
  onToggleFavourite: (status: Status) => void;
  onToggleReblog: (status: Status) => void;
  onDelete: (status: Status) => void;
  activeHandle: string;
}) => {
  const displayStatus = status.reblog ?? status;
  const boostedBy = status.reblog ? status.boostedBy : null;
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
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
  const timestamp = useMemo(
    () => new Date(displayStatus.createdAt).toLocaleString(),
    [displayStatus.createdAt]
  );
  const contentParts = useMemo(() => {
    const text = displayStatus.content;
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
        <a key={`link-${key}`} href={url} target="_blank" rel="noreferrer">
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
  }, [displayStatus.content]);

  const canDelete = Boolean(activeHandle) && displayHandle === activeHandle;

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
      {boostedBy ? (
        <div className="boosted-by">
          <img src={boostIconUrl} alt="" aria-hidden="true" />
          <span>
            {boostedBy.name || boostedHandle || boostedBy.handle} 님이 부스트함 (@
            {boostedHandle ?? boostedBy.handle})
          </span>
        </div>
      ) : null}
      {mentionNames ? (
        <div className="reply-info">
          <img src={replyIconUrl} alt="" aria-hidden="true" />
          <span>{mentionNames} 님께 보낸 댓글</span>
        </div>
      ) : null}
      <header>
        <div>
          <strong>
            {displayStatus.accountUrl ? (
              <a href={displayStatus.accountUrl} target="_blank" rel="noreferrer">
                {displayStatus.accountName || displayStatus.accountHandle}
              </a>
            ) : (
              displayStatus.accountName || displayStatus.accountHandle
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
      <div className="status-time">
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
            댓글
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
          >
            {displayStatus.reblogged ? "부스트 취소" : "부스트"}
            {displayStatus.reblogsCount > 0 ? ` (${displayStatus.reblogsCount})` : ""}
          </button>
          {attachments.map((item) => (
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
          ))}
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
                <div>
                  <strong>{displayStatus.accountName || displayStatus.accountHandle}</strong>
                  <span>@{displayHandle}</span>
                </div>
                <time dateTime={displayStatus.createdAt}>{timestamp}</time>
              </header>
              <p className="status-text confirm-text">
                {displayStatus.content || "(내용 없음)"}
              </p>
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
