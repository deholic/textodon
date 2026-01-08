import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, CustomEmoji, Visibility } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { 
  calculateCharacterCount, 
  getCharacterLimit, 
  getCharacterCountStatus, 
  getCharacterCountClassName,
  getDefaultCharacterLimit 
} from "../utils/characterCount";

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
    spoilerText: string;
  }) => Promise<boolean>;
  replyingTo: { id: string; summary: string } | null;
  onCancelReply: () => void;
  mentionText: string | null;
  accountSelector?: React.ReactNode;
  account: Account | null;
  api: MastodonApi;
}) => {
  const [text, setText] = useState("");
  const [cwEnabled, setCwEnabled] = useState(false);
  const [cwText, setCwText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const cwInputRef = useRef<HTMLInputElement | null>(null);
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
  
  // 문자 수 관련 상태
  const [characterLimit, setCharacterLimit] = useState<number | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(false);
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

  // 계정 변경 시 인스턴스 정보 로드
  useEffect(() => {
    if (!account) {
      setCharacterLimit(null);
      return;
    }
    
    const loadInstanceInfo = async () => {
      try {
        setInstanceLoading(true);
        const instanceInfo = await api.fetchInstanceInfo(account);
        const limit = getCharacterLimit(instanceInfo);
        setCharacterLimit(limit);
      } catch (error) {
        console.error("인스턴스 정보 로드 실패:", error);
        // fallback: 기본값 사용
        const fallbackLimit = getDefaultCharacterLimit(account.platform);
        setCharacterLimit(fallbackLimit);
      } finally {
        setInstanceLoading(false);
      }
    };
    
    loadInstanceInfo();
  }, [account, api]);

  // 현재 문자 수 계산
  const currentCharCount = useMemo(() => {
    if (!account) return 0;
    const fullText = (cwEnabled ? cwText + "\n" : "") + text;
    return calculateCharacterCount(fullText, account.platform);
  }, [text, cwText, cwEnabled, account]);

  // 문자 수 상태 계산
  const charCountStatus = useMemo(() => {
    if (!characterLimit) return "normal";
    return getCharacterCountStatus(currentCharCount, characterLimit);
  }, [currentCharCount, characterLimit]);

  const submitPost = async () => {
    if (!text.trim() || isSubmitting) {
      return;
    }

    // 문자 수 제한 검사
    if (characterLimit && currentCharCount > characterLimit) {
      alert(`글자 수 제한(${characterLimit.toLocaleString()}자)을 초과했습니다.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSubmit({
        text: text.trim(),
        visibility,
        inReplyToId: replyingTo?.id,
        files: attachments.map((item) => item.file),
        spoilerText: cwEnabled ? cwText.trim() : ""
      });
      if (ok) {
        setText("");
        setCwText("");
        setCwEnabled(false);
        setAttachments((current) => {
          current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
        setActiveImageId(null);
      }
    } finally {
      setIsSubmitting(false);
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

  const addAttachments = useCallback((files: File[]) => {
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
  }, []);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addAttachments(files);
    event.target.value = "";
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitting) {
      return;
    }
    const items = Array.from(event.clipboardData.items);
    const imageFiles: File[] = [];
    items.forEach((item) => {
      if (item.kind !== "file" || !item.type.startsWith("image/")) {
        return;
      }
      const file = item.getAsFile();
      if (file) {
        imageFiles.push(file);
      }
    });
    if (imageFiles.length > 0) {
      event.preventDefault();
      addAttachments(imageFiles);
    }
  };

  const toggleCw = () => {
    setCwEnabled((current) => {
      const next = !current;
      if (!next) {
        setCwText("");
      } else {
        requestAnimationFrame(() => {
          cwInputRef.current?.focus();
        });
      }
      return next;
    });
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
    <section className="panel compose-box">
      {accountSelector ? <div className="compose-account-select">{accountSelector}</div> : null}
      {replyingTo ? (
        <div className="replying">
          <span>답글 대상: {replyingTo.summary}</span>
          <button type="button" className="ghost" onClick={onCancelReply}>
            취소
          </button>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="compose-form" aria-busy={isSubmitting}>
        {cwEnabled ? (
          <div className="compose-cw">
            <input
              ref={cwInputRef}
              type="text"
              value={cwText}
              onChange={(event) => setCwText(event.target.value)}
              placeholder="CW 내용을 입력하세요"
              aria-label="콘텐츠 경고"
              disabled={isSubmitting}
            />
          </div>
        ) : null}
        <div className="compose-input-container">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="지금 무슨 생각을 하고 있나요?"
            rows={4}
            onPaste={handlePaste}
            disabled={isSubmitting}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submitPost();
              }
            }}
          />
          <div className="compose-attachments">
            {/* 첨부된 이미지들과 이미지 추가 버튼 */}
            <div className="compose-attachments-scroll">
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
              
              {/* 이미지 추가 버튼 */}
              <label className="file-button attachment-thumb" aria-label="이미지 추가">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="M21 16l-5-5-4 4-2-2-5 5" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  disabled={isSubmitting}
                />
              </label>
            </div>
            
            {/* 문자 수 표시 - 고정 위치 */}
            {characterLimit && (
              <div className="compose-attachments-character-count">
                <span className={getCharacterCountClassName(charCountStatus)}>
                  {currentCharCount.toLocaleString()} / {characterLimit.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="compose-actions">
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            disabled={isSubmitting}
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
              disabled={!account || isSubmitting}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 10.5h0.01" />
                <path d="M15.5 10.5h0.01" />
                <path d="M8.5 15.5c1.2 1 2.4 1.5 3.5 1.5s2.3-.5 3.5-1.5" />
              </svg>
            </button>
            <button
              type="button"
              className={`icon-button compose-icon-button${cwEnabled ? " is-active" : ""}`}
              aria-label="콘텐츠 경고 입력"
              aria-pressed={cwEnabled}
              onClick={toggleCw}
              disabled={isSubmitting}
            >
              CW
            </button>
            <button
              type="submit"
              className="icon-button compose-icon-button"
              aria-label="게시"
              disabled={isSubmitting}
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
      {isSubmitting ? (
        <div className="compose-busy" role="status" aria-live="polite">
          <div className="compose-busy-backdrop" aria-hidden="true" />
          <div className="compose-busy-content">
            <span className="compose-busy-spinner" aria-hidden="true" />
            <span>게시 중...</span>
          </div>
        </div>
      ) : null}
      {activeImage ? (
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
              setActiveImageId(null);
            }
          }}
        >
          <div className="image-modal-backdrop" onClick={() => setActiveImageId(null)} />
          <div
            className="image-modal-content"
            ref={imageContainerRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveImageId(null);
              }
            }}
          >
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


