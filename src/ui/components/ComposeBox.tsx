import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, CustomEmoji, Visibility } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";

const VISIBILITY_KEY = "textodon.compose.visibility";

const visibilityOptions: { value: Visibility; label: string }[] = [
  { value: "public", label: "전체 공개" },
  { value: "unlisted", label: "미등록" },
  { value: "private", label: "팔로워" },
  { value: "direct", label: "DM" }
];

const RECENT_EMOJI_KEY_PREFIX = "textodon.compose.recentEmojis.";
const RECENT_EMOJI_LIMIT = 24;
const ZERO_WIDTH_SPACE = "\u200b";

const buildRecentEmojiKey = (instanceUrl: string) =>
  `${RECENT_EMOJI_KEY_PREFIX}${encodeURIComponent(instanceUrl)}`;

const loadRecentEmojis = (instanceUrl: string): string[] => {
  try {
    const stored = localStorage.getItem(buildRecentEmojiKey(instanceUrl));
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
};

const persistRecentEmojis = (instanceUrl: string, list: string[]) => {
  try {
    localStorage.setItem(buildRecentEmojiKey(instanceUrl), JSON.stringify(list));
  } catch {
    return;
  }
};

export const ComposeBox = ({
  onSubmit,
  replyingTo,
  onCancelReply,
  mentionText,
  accountSelector,
  account,
  api
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
  accountSelector?: React.ReactNode;
  account: Account | null;
  api: MastodonApi;
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [emojiCatalogs, setEmojiCatalogs] = useState<Record<string, CustomEmoji[]>>({});
  const [emojiLoadState, setEmojiLoadState] = useState<
    Record<string, "idle" | "loading" | "loaded" | "error">
  >({});
  const [emojiErrors, setEmojiErrors] = useState<Record<string, string | null>>({});
  const [recentByInstance, setRecentByInstance] = useState<Record<string, string[]>>({});
  const [expandedByInstance, setExpandedByInstance] = useState<Record<string, Set<string>>>({});
  const [recentOpen, setRecentOpen] = useState(true);
  const activeImage = useMemo(
    () => attachments.find((item) => item.id === activeImageId) ?? null,
    [attachments, activeImageId]
  );
  const activeInstanceUrl = account?.instanceUrl ?? null;
  const activeEmojis = useMemo(
    () => (activeInstanceUrl ? emojiCatalogs[activeInstanceUrl] ?? [] : []),
    [activeInstanceUrl, emojiCatalogs]
  );
  const emojiStatus = activeInstanceUrl ? emojiLoadState[activeInstanceUrl] ?? "idle" : "idle";
  const recentShortcodes = activeInstanceUrl ? recentByInstance[activeInstanceUrl] ?? [] : [];
  const emojiMap = useMemo(() => new Map(activeEmojis.map((emoji) => [emoji.shortcode, emoji])), [activeEmojis]);
  const recentEmojis = useMemo(
    () => recentShortcodes.map((shortcode) => emojiMap.get(shortcode)).filter(Boolean) as CustomEmoji[],
    [emojiMap, recentShortcodes]
  );
  const categorizedEmojis = useMemo(() => {
    const grouped = new Map<string, CustomEmoji[]>();
    activeEmojis.forEach((emoji) => {
      const category = emoji.category?.trim() || "기타";
      const list = grouped.get(category) ?? [];
      list.push(emoji);
      grouped.set(category, list);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ko-KR"))
      .map(([label, emojis]) => ({ id: `category:${label}`, label, emojis }));
  }, [activeEmojis]);
  const emojiCategories = useMemo(() => {
    const categories = [...categorizedEmojis];
    if (recentEmojis.length > 0) {
      categories.unshift({ id: "recent", label: "최근 사용", emojis: recentEmojis });
    }
    return categories;
  }, [categorizedEmojis, recentEmojis]);
  const expandedCategories = activeInstanceUrl ? expandedByInstance[activeInstanceUrl] ?? new Set() : new Set();

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

  useEffect(() => {
    if (!activeInstanceUrl) {
      return;
    }
    setRecentByInstance((current) => {
      if (current[activeInstanceUrl]) {
        return current;
      }
      return { ...current, [activeInstanceUrl]: loadRecentEmojis(activeInstanceUrl) };
    });
    setExpandedByInstance((current) => {
      if (current[activeInstanceUrl]) {
        return current;
      }
      return { ...current, [activeInstanceUrl]: new Set() };
    });
  }, [activeInstanceUrl]);

  useEffect(() => {
    if (!emojiPanelOpen || !activeInstanceUrl || !account) {
      return;
    }
    if (emojiStatus === "loaded") {
      return;
    }
    setEmojiLoadState((current) => ({ ...current, [activeInstanceUrl]: "loading" }));
    setEmojiErrors((current) => ({ ...current, [activeInstanceUrl]: null }));
    const load = async () => {
      try {
        const emojis = await api.fetchCustomEmojis(account);
        setEmojiCatalogs((current) => ({ ...current, [activeInstanceUrl]: emojis }));
        setEmojiLoadState((current) => ({ ...current, [activeInstanceUrl]: "loaded" }));
      } catch (err) {
        setEmojiLoadState((current) => ({ ...current, [activeInstanceUrl]: "error" }));
        setEmojiErrors((current) => ({
          ...current,
          [activeInstanceUrl]: err instanceof Error ? err.message : "이모지를 불러오지 못했습니다."
        }));
      }
    };
    void load();
  }, [account, activeInstanceUrl, api, emojiPanelOpen, emojiStatus]);

  useEffect(() => {
    if (!emojiPanelOpen) {
      return;
    }
    setRecentOpen(true);
  }, [emojiPanelOpen]);

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

  const insertEmoji = (shortcode: string) => {
    const value = `${ZERO_WIDTH_SPACE}:${shortcode}:${ZERO_WIDTH_SPACE}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((current) => `${current}${value}`);
      return;
    }
    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${value}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + value.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleEmojiSelect = (emoji: CustomEmoji) => {
    if (!activeInstanceUrl) {
      return;
    }
    insertEmoji(emoji.shortcode);
    setRecentByInstance((current) => {
      const currentList = current[activeInstanceUrl] ?? [];
      const filtered = currentList.filter((item) => item !== emoji.shortcode);
      const nextList = [emoji.shortcode, ...filtered].slice(0, RECENT_EMOJI_LIMIT);
      persistRecentEmojis(activeInstanceUrl, nextList);
      return { ...current, [activeInstanceUrl]: nextList };
    });
  };

  const toggleCategory = (categoryId: string) => {
    if (!activeInstanceUrl) {
      return;
    }
    if (categoryId === "recent") {
      setRecentOpen((current) => !current);
      return;
    }
    setExpandedByInstance((current) => {
      const next = new Set(current[activeInstanceUrl] ?? []);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...current, [activeInstanceUrl]: next };
    });
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
      {accountSelector ? <div className="compose-account-select">{accountSelector}</div> : null}
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
          ref={textareaRef}
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
            <button
              type="button"
              className={`icon-button compose-icon-button${emojiPanelOpen ? " is-active" : ""}`}
              aria-label="커스텀 이모지 팔렛트 열기"
              onClick={() => setEmojiPanelOpen((open) => !open)}
              disabled={!account}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 10.5h0.01" />
                <path d="M15.5 10.5h0.01" />
                <path d="M8.5 15.5c1.2 1 2.4 1.5 3.5 1.5s2.3-.5 3.5-1.5" />
              </svg>
            </button>
            <label className="file-button icon-button compose-icon-button" aria-label="이미지 추가">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 16l-5-5-4 4-2-2-5 5" />
              </svg>
              <input type="file" accept="image/*" multiple onChange={handleFilesSelected} />
            </label>
            <button
              type="submit"
              className="icon-button compose-icon-button"
              aria-label="게시"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
        {emojiPanelOpen ? (
          <div className="compose-emoji-panel" role="region" aria-label="커스텀 이모지 팔렛트">
            {!account ? <p className="compose-emoji-empty">계정을 선택해주세요.</p> : null}
            {account && emojiStatus === "loading" ? (
              <p className="compose-emoji-empty">이모지를 불러오는 중...</p>
            ) : null}
            {account && emojiStatus === "error" ? (
              <div className="compose-emoji-empty">
                <p>{emojiErrors[activeInstanceUrl ?? ""] ?? "이모지를 불러오지 못했습니다."}</p>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    if (!activeInstanceUrl) {
                      return;
                    }
                    setEmojiLoadState((current) => ({ ...current, [activeInstanceUrl]: "idle" }));
                  }}
                >
                  다시 불러오기
                </button>
              </div>
            ) : null}
            {account && emojiStatus === "loaded" && emojiCategories.length === 0 ? (
              <p className="compose-emoji-empty">사용할 수 있는 커스텀 이모지가 없습니다.</p>
            ) : null}
            {account && emojiStatus === "loaded"
              ? emojiCategories.map((category) => {
                  const categoryKey = `${activeInstanceUrl ?? "unknown"}::${category.id}`;
                  const isCollapsed =
                    category.id === "recent" ? !recentOpen : !expandedCategories.has(category.id);
                  return (
                    <section key={categoryKey} className="compose-emoji-category">
                      <button
                        type="button"
                        className="compose-emoji-category-toggle"
                        onClick={() => toggleCategory(category.id)}
                        aria-expanded={!isCollapsed}
                      >
                        <span>{category.label}</span>
                        <span className="compose-emoji-count">{category.emojis.length}</span>
                      </button>
                      {isCollapsed ? null : (
                        <div className="compose-emoji-grid">
                          {category.emojis.map((emoji) => (
                            <button
                              key={`${category.id}:${emoji.shortcode}`}
                              type="button"
                              className="compose-emoji-button"
                              onClick={() => handleEmojiSelect(emoji)}
                              aria-label={`이모지 ${emoji.shortcode}`}
                            >
                              <img src={emoji.url} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })
              : null}
          </div>
        ) : null}
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
