import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, CustomEmoji, ReactionInput } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { getCachedEmojis, setCachedEmojis } from "../utils/emojiCache";

const RECENT_EMOJI_KEY_PREFIX = "textodon.compose.recentEmojis.";
const RECENT_EMOJI_LIMIT = 24;

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

export const ReactionPicker = ({
  account,
  api,
  disabled = false,
  onSelect
}: {
  account: Account | null;
  api: MastodonApi;
  disabled?: boolean;
  onSelect: (reaction: ReactionInput) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [emojiState, setEmojiState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [emojiError, setEmojiError] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [recentByInstance, setRecentByInstance] = useState<Record<string, string[]>>({});
  const [expandedByInstance, setExpandedByInstance] = useState<Record<string, Set<string>>>({});
  const [recentOpen, setRecentOpen] = useState(true);
  const instanceUrl = account?.instanceUrl ?? null;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const emojiMap = useMemo(() => new Map(emojis.map((emoji) => [emoji.shortcode, emoji])), [emojis]);
  const recentShortcodes = instanceUrl ? recentByInstance[instanceUrl] ?? [] : [];
  const recentEmojis = useMemo(
    () => recentShortcodes.map((shortcode) => emojiMap.get(shortcode)).filter(Boolean) as CustomEmoji[],
    [emojiMap, recentShortcodes]
  );

  const categorizedEmojis = useMemo(() => {
    const grouped = new Map<string, CustomEmoji[]>();
    emojis.forEach((emoji) => {
      const category = emoji.category?.trim() || "기타";
      const list = grouped.get(category) ?? [];
      list.push(emoji);
      grouped.set(category, list);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ko-KR"))
      .map(([label, list]) => ({ id: `category:${label}`, label, emojis: list }));
  }, [emojis]);

  const emojiCategories = useMemo(() => {
    const categories = [...categorizedEmojis];
    if (recentEmojis.length > 0) {
      categories.unshift({ id: "recent", label: "최근 사용", emojis: recentEmojis });
    }
    return categories;
  }, [categorizedEmojis, recentEmojis]);
  const expandedCategories = instanceUrl ? expandedByInstance[instanceUrl] ?? new Set() : new Set();

  useEffect(() => {
    if (!instanceUrl) {
      setEmojis([]);
      setEmojiState("idle");
      setEmojiError(null);
      return;
    }
    const cached = getCachedEmojis(instanceUrl);
    if (cached) {
      setEmojis(cached);
      setEmojiState("loaded");
      setEmojiError(null);
      return;
    }
    setEmojis([]);
    setEmojiState("idle");
    setEmojiError(null);
  }, [instanceUrl]);

  useEffect(() => {
    if (!instanceUrl) {
      return;
    }
    setRecentByInstance((current) => {
      if (current[instanceUrl]) {
        return current;
      }
      return { ...current, [instanceUrl]: loadRecentEmojis(instanceUrl) };
    });
    setExpandedByInstance((current) => {
      if (current[instanceUrl]) {
        return current;
      }
      return { ...current, [instanceUrl]: new Set() };
    });
  }, [instanceUrl]);

  useEffect(() => {
    if (!open || !account) {
      return;
    }
    if (emojiState === "loaded") {
      return;
    }
    if (instanceUrl) {
      const cached = getCachedEmojis(instanceUrl);
      if (cached) {
        setEmojis(cached);
        setEmojiState("loaded");
        setEmojiError(null);
        return;
      }
    }
    let cancelled = false;
    const loadEmojis = async () => {
      setEmojiState("loading");
      setEmojiError(null);
      try {
        const list = await api.fetchCustomEmojis(account);
        if (cancelled) {
          return;
        }
        setCachedEmojis(account.instanceUrl, list);
        setEmojis(list);
        setEmojiState("loaded");
      } catch (err) {
        if (cancelled) {
          return;
        }
        setEmojiState("error");
        setEmojiError(err instanceof Error ? err.message : "이모지를 불러오지 못했습니다.");
      }
    };
    void loadEmojis();
    return () => {
      cancelled = true;
    };
  }, [account, api, emojiState, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (buttonRef.current?.contains(event.target)) {
        return;
      }
      if (panelRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRecentOpen(true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let frame = 0;
    const updatePosition = () => {
      if (!buttonRef.current || !panelRef.current) {
        return;
      }
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const margin = 12;
      let top = buttonRect.top - panelRect.height - margin;
      const shouldFlip = top < margin;
      if (shouldFlip) {
        top = Math.min(window.innerHeight - panelRect.height - margin, buttonRect.bottom + margin);
      }
      let left = buttonRect.right - panelRect.width;
      if (left < margin) {
        left = margin;
      }
      if (left + panelRect.width > window.innerWidth - margin) {
        left = window.innerWidth - panelRect.width - margin;
      }
      setPanelStyle({ top, left });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, emojis.length]);

  const categories = useMemo(() => {
    const grouped = new Map<string, CustomEmoji[]>();
    emojis.forEach((emoji) => {
      const category = emoji.category?.trim() || "기타";
      const list = grouped.get(category) ?? [];
      list.push(emoji);
      grouped.set(category, list);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ko-KR"))
      .map(([label, list]) => ({
        label,
        emojis: [...list].sort((a, b) => a.shortcode.localeCompare(b.shortcode, "ko-KR"))
      }));
  }, [emojis]);

  const handleSelect = useCallback(
    (emoji: CustomEmoji) => {
      if (!instanceUrl) {
        return;
      }
      onSelect({
        name: `:${emoji.shortcode}:`,
        url: emoji.url,
        isCustom: true,
        host: null
      });
      setRecentByInstance((current) => {
        const currentList = current[instanceUrl] ?? [];
        const filtered = currentList.filter((item) => item !== emoji.shortcode);
        const nextList = [emoji.shortcode, ...filtered].slice(0, RECENT_EMOJI_LIMIT);
        persistRecentEmojis(instanceUrl, nextList);
        return { ...current, [instanceUrl]: nextList };
      });
      setOpen(false);
    },
    [instanceUrl, onSelect]
  );

  const toggleCategory = (categoryId: string) => {
    if (!instanceUrl) {
      return;
    }
    if (categoryId === "recent") {
      setRecentOpen((current) => !current);
      return;
    }
    setExpandedByInstance((current) => {
      const next = new Set(current[instanceUrl] ?? []);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...current, [instanceUrl]: next };
    });
  };

  return (
    <div className="reaction-picker">
      <button
        type="button"
        className={`reaction-picker-toggle${open ? " is-active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        ref={buttonRef}
        aria-label="리액션 추가"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        리액션
      </button>
      {open ? (
        <>
          <div className="overlay-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="reaction-picker-panel"
            role="dialog"
            aria-modal="true"
            aria-label="리액션 선택"
            ref={panelRef}
            style={panelStyle}
          >
            <div className="compose-emoji-panel reaction-emoji-panel">
              {!account ? <p className="compose-emoji-empty">계정을 선택해주세요.</p> : null}
              {account && emojiState === "loading" ? (
                <p className="compose-emoji-empty">이모지를 불러오는 중...</p>
              ) : null}
              {account && emojiState === "error" ? (
                <div className="compose-emoji-empty">
                  <p>{emojiError ?? "이모지를 불러오지 못했습니다."}</p>
                  <button type="button" className="ghost" onClick={() => setEmojiState("idle")}>
                    다시 불러오기
                  </button>
                </div>
              ) : null}
              {account && emojiState === "loaded" && emojiCategories.length === 0 ? (
                <p className="compose-emoji-empty">사용할 수 있는 커스텀 이모지가 없습니다.</p>
              ) : null}
              {account && emojiState === "loaded"
                ? emojiCategories.map((category) => {
                    const categoryKey = `${instanceUrl ?? "unknown"}::${category.id}`;
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
                                onClick={() => handleSelect(emoji)}
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
          </div>
        </>
      ) : null}
    </div>
  );
};
