import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, CustomEmoji, ReactionInput, Status, UserProfile } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { sanitizeHtml } from "../utils/htmlSanitizer";
import { formatHandle } from "../utils/account";
import { isPlainUrl, renderTextWithLinks } from "../utils/linkify";
import { useClickOutside } from "../hooks/useClickOutside";
import { TimelineItem } from "./TimelineItem";

const PAGE_SIZE = 20;

const buildFallbackProfile = (status: Status): UserProfile => ({
  id: status.accountId ?? "",
  name: status.accountName || status.accountHandle,
  handle: status.accountHandle,
  url: status.accountUrl,
  avatarUrl: status.accountAvatarUrl,
  headerUrl: null,
  bio: "",
  fields: []
});

const hasHtmlTags = (value: string): boolean => /<[^>]+>/.test(value);

const buildEmojiMap = (emojis: CustomEmoji[]): Map<string, string> =>
  new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));

const tokenizeWithEmojis = (
  text: string,
  emojiMap: Map<string, string>
): Array<{ type: "text"; value: string } | { type: "emoji"; name: string; url: string }> => {
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
};

export const ProfileModal = ({
  status,
  account,
  api,
  isTopmost,
  onClose,
  onReply,
  onStatusClick,
  onProfileClick,
  showProfileImage,
  showCustomEmojis,
  showReactions
}: {
  status: Status;
  account: Account | null;
  api: MastodonApi;
  isTopmost: boolean;
  onClose: () => void;
  onReply: (status: Status, account: Account | null) => void;
  onStatusClick: (status: Status) => void;
  onProfileClick: (status: Status, account: Account | null) => void;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
  showReactions: boolean;
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [items, setItems] = useState<Status[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const targetAccountId = status.accountId;
  const emojiMap = useMemo(
    () => (showCustomEmojis ? buildEmojiMap(status.accountEmojis) : new Map()),
    [showCustomEmojis, status.accountEmojis]
  );

  useClickOutside(scrollRef, isTopmost, onClose);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!account || !targetAccountId) {
      setProfile(null);
      setProfileError("프로필 정보를 불러올 수 없습니다.");
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfile(null);
    setProfileLoading(true);
    setProfileError(null);
    api
      .fetchAccountProfile(account, targetAccountId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setProfileError(error instanceof Error ? error.message : "프로필 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (cancelled) return;
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, api, targetAccountId]);

  useEffect(() => {
    if (!account || !targetAccountId) {
      setItems([]);
      setHasMore(false);
      setItemsLoading(false);
      setItemsLoadingMore(false);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    setItemsError(null);
    setHasMore(true);
    setItems([]);
    setItemsLoadingMore(false);
    api
      .fetchAccountStatuses(account, targetAccountId, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch((error) => {
        if (cancelled) return;
        setItemsError(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
        setItems([]);
      })
      .finally(() => {
        if (cancelled) return;
        setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, api, targetAccountId]);

  const updateItem = useCallback((next: Status) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const removeItem = useCallback((statusId: string) => {
    setItems((current) => current.filter((item) => item.id !== statusId));
  }, []);

  const handleToggleFavourite = useCallback(
    async (target: Status) => {
      if (!account) {
        setItemsError("계정을 선택해 주세요.");
        return;
      }
      setItemsError(null);
      try {
        const updated = target.favourited
          ? await api.unfavourite(account, target.id)
          : await api.favourite(account, target.id);
        updateItem(updated);
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "좋아요 처리에 실패했습니다.");
      }
    },
    [account, api, updateItem]
  );

  const handleToggleReblog = useCallback(
    async (target: Status) => {
      if (!account) {
        setItemsError("계정을 선택해 주세요.");
        return;
      }
      setItemsError(null);
      try {
        const updated = target.reblogged
          ? await api.unreblog(account, target.id)
          : await api.reblog(account, target.id);
        updateItem(updated);
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "부스트 처리에 실패했습니다.");
      }
    },
    [account, api, updateItem]
  );

  const handleDeleteStatus = useCallback(
    async (target: Status) => {
      if (!account) {
        return;
      }
      setItemsError(null);
      try {
        await api.deleteStatus(account, target.id);
        removeItem(target.id);
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "게시글 삭제에 실패했습니다.");
      }
    },
    [account, api, removeItem]
  );

  const handleReact = useCallback(
    async (target: Status, reaction: ReactionInput) => {
      if (!account) {
        setItemsError("계정을 선택해 주세요.");
        return;
      }
      if (account.platform !== "misskey") {
        setItemsError("리액션은 미스키 계정에서만 사용할 수 있습니다.");
        return;
      }
      if (target.myReaction && target.myReaction !== reaction.name) {
        setItemsError("다른 리액션을 선택했습니다. 먼저 취소해 주세요.");
        return;
      }
      setItemsError(null);
      try {
        const updated =
          target.myReaction === reaction.name
            ? await api.deleteReaction(account, target.id)
            : await api.createReaction(account, target.id, reaction.name);
        updateItem(updated);
      } catch (error) {
        setItemsError(error instanceof Error ? error.message : "리액션 처리에 실패했습니다.");
      }
    },
    [account, api, updateItem]
  );

  const loadMore = useCallback(async () => {
    if (!account || !targetAccountId || itemsLoadingMore || itemsLoading || !hasMore) {
      return;
    }
    const lastId = items[items.length - 1]?.id;
    if (!lastId) {
      return;
    }
    setItemsLoadingMore(true);
    setItemsError(null);
    try {
      const next = await api.fetchAccountStatuses(account, targetAccountId, PAGE_SIZE, lastId);
      setItems((current) => [...current, ...next]);
      if (next.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (error) {
      setItemsError(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
    } finally {
      setItemsLoadingMore(false);
    }
  }, [account, api, targetAccountId, hasMore, items, itemsLoading, itemsLoadingMore]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const threshold = el.scrollHeight - el.clientHeight - 240;
    if (el.scrollTop >= threshold) {
      loadMore();
    }
  }, [loadMore]);

  const renderTextWithEmojis = useCallback(
    (text: string, keyPrefix: string, withLineBreaks: boolean) => {
      const lines = withLineBreaks ? text.split(/\r?\n/) : [text];
      const nodes: React.ReactNode[] = [];
      lines.forEach((line, lineIndex) => {
        if (withLineBreaks && lineIndex > 0) {
          nodes.push(<br key={`${keyPrefix}-br-${lineIndex}`} />);
        }
        const tokens =
          showCustomEmojis && emojiMap.size > 0
            ? tokenizeWithEmojis(line, emojiMap)
            : [{ type: "text" as const, value: line }];
        tokens.forEach((token, index) => {
          if (token.type === "text") {
            nodes.push(...renderTextWithLinks(token.value, `${keyPrefix}-${lineIndex}-${index}`));
          } else {
            nodes.push(
              <img
                key={`${keyPrefix}-emoji-${lineIndex}-${index}`}
                src={token.url}
                alt={`:${token.name}:`}
                className="custom-emoji"
                loading="lazy"
              />
            );
          }
        });
      });
      return nodes;
    },
    [emojiMap, showCustomEmojis]
  );

  const displayProfile = profile ?? buildFallbackProfile(status);
  const displayName = displayProfile.name || status.accountName || status.accountHandle;
  const rawHandle = displayProfile.handle || status.accountHandle;
  const displayHandle = useMemo(() => {
    if (!rawHandle) {
      return "";
    }
    if (rawHandle.includes("@")) {
      return rawHandle;
    }
    if (displayProfile.url) {
      try {
        const host = new URL(displayProfile.url).hostname;
        return `${rawHandle}@${host}`;
      } catch {
        return rawHandle;
      }
    }
    if (account) {
      return formatHandle(rawHandle, account.instanceUrl);
    }
    return rawHandle;
  }, [account, displayProfile.url, rawHandle]);
  const handleText = displayHandle ? (displayHandle.startsWith("@") ? displayHandle : `@${displayHandle}`) : "";
  const bioContent = useMemo(() => {
    if (!displayProfile.bio) {
      return null;
    }
    if (hasHtmlTags(displayProfile.bio)) {
      return { type: "html" as const, value: sanitizeHtml(displayProfile.bio) };
    }
    return {
      type: "text" as const,
      value: renderTextWithEmojis(displayProfile.bio, "profile-bio", true)
    };
  }, [displayProfile.bio, renderTextWithEmojis]);
  const activeHandle = account?.handle ? formatHandle(account.handle, account.instanceUrl) : account?.instanceUrl ?? "";

  const renderFieldValue = useCallback(
    (value: string, index: number) => {
      if (hasHtmlTags(value)) {
        return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />;
      }
      const nodes = renderTextWithEmojis(value, `profile-field-${index}`, false);
      if (isPlainUrl(value)) {
        return <span className="profile-field-link">{nodes}</span>;
      }
      return <span>{nodes}</span>;
    },
    [renderTextWithEmojis]
  );

  const renderFieldLabel = useCallback(
    (label: string, index: number) => {
      if (hasHtmlTags(label)) {
        return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(label) }} />;
      }
      return <span>{renderTextWithEmojis(label, `profile-field-label-${index}`, false)}</span>;
    },
    [renderTextWithEmojis]
  );

  return (
    <div className="profile-modal" role="dialog" aria-modal="true" aria-label="사용자 프로필">
      <div className="profile-modal-backdrop" onClick={onClose} />
      <div className="profile-modal-content" ref={scrollRef} onScroll={handleScroll}>
        <div className="profile-modal-header">
          <h3 className="profile-modal-title">프로필</h3>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="프로필 닫기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <section className="profile-info">
          <div className="profile-hero">
            <div
              className="profile-hero-bg"
              style={displayProfile.headerUrl ? { backgroundImage: `url(${displayProfile.headerUrl})` } : undefined}
            />
            <div className="profile-hero-overlay" />
            <div className="profile-hero-content">
              <div className="profile-avatar">
                {displayProfile.avatarUrl ? (
                  <img src={displayProfile.avatarUrl} alt={`${displayName} 프로필 이미지`} loading="lazy" />
                ) : (
                  <span className="profile-avatar-fallback" aria-hidden="true" />
                )}
              </div>
              <div className="profile-title">
                <strong>{renderTextWithEmojis(displayName, "profile-name", false)}</strong>
                {handleText ? <span>{handleText}</span> : null}
              </div>
            </div>
          </div>
          {profileLoading ? <p className="empty">프로필을 불러오는 중...</p> : null}
          {profileError ? <p className="error">{profileError}</p> : null}
          {bioContent
            ? bioContent.type === "html"
              ? <div className="profile-bio" dangerouslySetInnerHTML={{ __html: bioContent.value }} />
              : <div className="profile-bio">{bioContent.value}</div>
            : null}
          {displayProfile.fields.length > 0 ? (
            <dl className="profile-fields">
              {displayProfile.fields.map((field, index) => (
                <div key={`${field.label}-${index}`} className="profile-field">
                  <dt>{renderFieldLabel(field.label, index)}</dt>
                  <dd>{renderFieldValue(field.value, index)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
        <section className="profile-posts">
          <h4>작성한 글</h4>
          {itemsError ? <p className="error">{itemsError}</p> : null}
          {itemsLoading && items.length === 0 ? <p className="empty">게시글을 불러오는 중...</p> : null}
          {!itemsLoading && items.length === 0 ? <p className="empty">표시할 글이 없습니다.</p> : null}
          {items.length > 0 ? (
            <div className="timeline">
              {items.map((item) => (
                <TimelineItem
                  key={item.id}
                  status={item}
                  onReply={(target) => onReply(target, account)}
                  onToggleFavourite={handleToggleFavourite}
                  onToggleReblog={handleToggleReblog}
                  onDelete={handleDeleteStatus}
                  onReact={handleReact}
                  onStatusClick={onStatusClick}
                  onProfileClick={(target) => onProfileClick(target, account)}
                  activeHandle={activeHandle}
                  activeAccountHandle={account?.handle ?? ""}
                  activeAccountUrl={account?.url ?? null}
                  account={account}
                  api={api}
                  showProfileImage={showProfileImage}
                  showCustomEmojis={showCustomEmojis}
                  showReactions={showReactions}
                />
              ))}
            </div>
          ) : null}
          {itemsLoadingMore ? <p className="empty">더 불러오는 중...</p> : null}
        </section>
      </div>
    </div>
  );
};
