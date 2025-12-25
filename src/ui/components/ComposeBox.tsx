import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Visibility } from "../../domain/types";

const VISIBILITY_KEY = "textodon.compose.visibility";

const visibilityOptions: { value: Visibility; label: string }[] = [
  { value: "public", label: "전체 공개" },
  { value: "unlisted", label: "미등록" },
  { value: "private", label: "팔로워" },
  { value: "direct", label: "DM" }
];

export const ComposeBox = ({
  onSubmit,
  replyingTo,
  onCancelReply,
  mentionText
}: {
  onSubmit: (params: {
    text: string;
    visibility: Visibility;
    inReplyToId?: string;
    files: File[];
  }) => Promise<boolean>;
  replyingTo: { id: string; summary: string } | null;
  onCancelReply: () => void;
  mentionText: string | null;
}) => {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(() => {
    const stored = localStorage.getItem(VISIBILITY_KEY);
    if (stored === "public" || stored === "unlisted" || stored === "private" || stored === "direct") {
      return stored;
    }
    return "public";
  });
  const [attachments, setAttachments] = useState<
    { id: string; file: File; previewUrl: string }[]
  >([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const activeImage = useMemo(
    () => attachments.find((item) => item.id === activeImageId) ?? null,
    [attachments, activeImageId]
  );

  useEffect(() => {
    if (!activeImage) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeImage]);

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

  useEffect(() => {
    localStorage.setItem(VISIBILITY_KEY, visibility);
  }, [visibility]);

  const submitPost = async () => {
    if (!text.trim()) {
      return;
    }
    const ok = await onSubmit({
      text: text.trim(),
      visibility,
      inReplyToId: replyingTo?.id,
      files: attachments.map((item) => item.file)
    });
    if (ok) {
      setText("");
      setAttachments((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setActiveImageId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitPost();
  };

  useEffect(() => {
    if (mentionText) {
      setText(mentionText);
    }
  }, [mentionText]);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
    event.target.value = "";
  };

  const handleDeleteActive = () => {
    if (!activeImage) {
      return;
    }
    setAttachments((current) => {
      const next = current.filter((item) => item.id !== activeImage.id);
      URL.revokeObjectURL(activeImage.previewUrl);
      return next;
    });
    setActiveImageId(null);
  };

  useEffect(() => {
    return () => {
      attachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [attachments]);

  return (
    <section className="panel">
      {replyingTo ? (
        <div className="replying">
          <span>답글 대상: {replyingTo.summary}</span>
          <button type="button" className="ghost" onClick={onCancelReply}>
            취소
          </button>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="compose-form">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="지금 무슨 생각을 하고 있나요?"
          rows={4}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submitPost();
            }
          }}
        />
        {attachments.length > 0 ? (
          <div className="compose-attachments">
            {attachments.map((item) => (
              <button
                key={item.id}
                type="button"
                className="attachment-thumb"
                onClick={() => {
                  setImageZoom(1);
                  setImageOffset({ x: 0, y: 0 });
                  setActiveImageId(item.id);
                }}
                aria-label="이미지 미리보기"
              >
                <img src={item.previewUrl} alt="선택한 이미지" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="compose-actions">
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="compose-actions-right">
            <label className="file-button">
              이미지 추가
              <input type="file" accept="image/*" multiple onChange={handleFilesSelected} />
            </label>
            <button type="submit">게시</button>
          </div>
        </div>
      </form>
      {activeImage ? (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          onWheel={(event) => event.preventDefault()}
        >
          <div className="image-modal-backdrop" onClick={() => setActiveImageId(null)} />
          <div className="image-modal-content" ref={imageContainerRef}>
            <div className="image-modal-actions">
              <button
                type="button"
                className="image-modal-delete"
                onClick={handleDeleteActive}
              >
                삭제
              </button>
              <button type="button" onClick={() => setActiveImageId(null)}>
                닫기
              </button>
            </div>
            <img
              src={activeImage.previewUrl}
              alt="선택한 이미지 원본"
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
    </section>
  );
};
