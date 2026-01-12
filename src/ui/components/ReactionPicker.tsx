import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Account, ReactionInput } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { useClickOutside } from "../hooks/useClickOutside";
import { useEmojiManager, type EmojiItem } from "../hooks/useEmojiManager";

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
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [recentOpen, setRecentOpen] = useState(true);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // useEmojiManager 훅 사용
  const {
    emojis,
    emojiStatus,
    emojiError,
    emojiCategories,
    customEmojiCategories,
    standardEmojiCategories,
    expandedCategories,
    loadEmojis,
    addToRecent,
    toggleCategory
  } = useEmojiManager(account, api, false);

  // 패널이 열리면 이모지 로드
  useEffect(() => {
    if (open && account) {
      void loadEmojis();
    }
  }, [open, account, loadEmojis]);

  useClickOutside(panelRef, open, () => setOpen(false), [buttonRef]);

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

  const handleSelect = useCallback(
    (emoji: EmojiItem) => {
      if (emoji.isCustom && emoji.shortcode) {
        onSelect({
          name: `:${emoji.shortcode}:`,
          url: emoji.url ?? null,
          isCustom: true,
          host: null
        });
      } else if (emoji.unicode) {
        onSelect({
          name: emoji.unicode,
          url: null,
          isCustom: false,
          host: null
        });
      } else {
        return;
      }
      addToRecent(emoji.id);
      setOpen(false);
    },
    [onSelect, addToRecent]
  );

  const handleToggleCategory = (categoryId: string) => {
    if (categoryId === "recent") {
      setRecentOpen((current) => !current);
    } else {
      toggleCategory(categoryId);
    }
  };

  return (
    <div className="reaction-picker">
      <button
        type="button"
        className={open ? "is-active" : undefined}
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
          <div className="overlay-backdrop" aria-hidden="true" />
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
              {account && emojiStatus === "loading" ? (
                <p className="compose-emoji-empty">이모지를 불러오는 중...</p>
              ) : null}
              {account && emojiStatus === "error" ? (
                <div className="compose-emoji-empty">
                  <p>{emojiError ?? "이모지를 불러오지 못했습니다."}</p>
                  <button type="button" className="ghost" onClick={() => loadEmojis()}>
                    다시 불러오기
                  </button>
                </div>
              ) : null}
              {account && emojiCategories.length === 0 ? (
                <p className="compose-emoji-empty">사용할 수 있는 이모지가 없습니다.</p>
              ) : null}
              {account && emojiCategories.length > 0 ? (
                <>
                  {(() => {
                    const recentCategory = emojiCategories.find((item) => item.id === "recent");
                    if (!recentCategory) return null;
                    const categoryKey = `${account.instanceUrl}::${recentCategory.id}`;
                    const isCollapsed = !recentOpen;
                    return (
                      <section key={categoryKey} className="compose-emoji-category">
                        <button
                          type="button"
                          className="compose-emoji-category-toggle"
                          onClick={() => handleToggleCategory(recentCategory.id)}
                          aria-expanded={!isCollapsed}
                        >
                          <span>{recentCategory.label}</span>
                          <span className="compose-emoji-count">{recentCategory.emojis.length}</span>
                        </button>
                        {isCollapsed ? null : (
                          <div className="compose-emoji-grid">
                            {recentCategory.emojis.map((emoji) => (
                              <button
                                key={`${recentCategory.id}:${emoji.id}`}
                                type="button"
                                className="compose-emoji-button"
                                onClick={() => handleSelect(emoji)}
                                aria-label={`이모지 ${emoji.label}`}
                              >
                                {emoji.unicode ? (
                                  <span className="compose-emoji-text" aria-hidden="true">
                                    {emoji.unicode}
                                  </span>
                                ) : emoji.url ? (
                                  <img src={emoji.url} alt="" loading="lazy" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })()}
                  {customEmojiCategories.map((category) => {
                    const categoryKey = `${account.instanceUrl}::${category.id}`;
                    const isCollapsed = !expandedCategories.has(category.id);
                    return (
                      <section key={categoryKey} className="compose-emoji-category">
                        <button
                          type="button"
                          className="compose-emoji-category-toggle"
                          onClick={() => handleToggleCategory(category.id)}
                          aria-expanded={!isCollapsed}
                        >
                          <span>{category.label}</span>
                          <span className="compose-emoji-count">{category.emojis.length}</span>
                        </button>
                        {isCollapsed ? null : (
                          <div className="compose-emoji-grid">
                            {category.emojis.map((emoji) => (
                              <button
                                key={`${category.id}:${emoji.id}`}
                                type="button"
                                className="compose-emoji-button"
                                onClick={() => handleSelect(emoji)}
                                aria-label={`이모지 ${emoji.label}`}
                              >
                                {emoji.unicode ? (
                                  <span className="compose-emoji-text" aria-hidden="true">
                                    {emoji.unicode}
                                  </span>
                                ) : emoji.url ? (
                                  <img src={emoji.url} alt="" loading="lazy" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                  {customEmojiCategories.length > 0 && standardEmojiCategories.length > 0 ? (
                    <div
                      className="compose-emoji-divider"
                      role="separator"
                      aria-label="표준 이모지 구분선"
                    >
                      <span>표준 이모지</span>
                    </div>
                  ) : null}
                  {standardEmojiCategories.map((category) => {
                    const categoryKey = `${account.instanceUrl}::${category.id}`;
                    const isCollapsed = !expandedCategories.has(category.id);
                    return (
                      <section key={categoryKey} className="compose-emoji-category">
                        <button
                          type="button"
                          className="compose-emoji-category-toggle"
                          onClick={() => handleToggleCategory(category.id)}
                          aria-expanded={!isCollapsed}
                        >
                          <span>{category.label}</span>
                          <span className="compose-emoji-count">{category.emojis.length}</span>
                        </button>
                        {isCollapsed ? null : (
                          <div className="compose-emoji-grid">
                            {category.emojis.map((emoji) => (
                              <button
                                key={`${category.id}:${emoji.id}`}
                                type="button"
                                className="compose-emoji-button"
                                onClick={() => handleSelect(emoji)}
                                aria-label={`이모지 ${emoji.label}`}
                              >
                                {emoji.unicode ? (
                                  <span className="compose-emoji-text" aria-hidden="true">
                                    {emoji.unicode}
                                  </span>
                                ) : emoji.url ? (
                                  <img src={emoji.url} alt="" loading="lazy" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
