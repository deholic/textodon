import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Account,
  AccountRelationship,
  CustomEmoji,
  ReactionInput,
  Status,
  UserProfile
} from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { sanitizeHtml } from "../utils/htmlSanitizer";
import { formatHandle } from "../utils/account";
import { isPlainUrl, renderTextWithLinks } from "../utils/linkify";
import { renderMarkdown } from "../utils/markdown";
import { useClickOutside } from "../hooks/useClickOutside";
import { useToast } from "../state/ToastContext";
import { TimelineItem } from "./TimelineItem";

const PAGE_SIZE = 20;

const buildFallbackProfile = (status: Status): UserProfile => ({
  id: status.accountId ?? "",
  name: status.accountName || status.accountHandle,
  handle: status.accountHandle,
  url: status.accountUrl,
  avatarUrl: status.accountAvatarUrl,
  headerUrl: null,
  locked: false,
  bio: "",
  fields: []
});

const hasHtmlTags = (value: string): boolean => /<[^>]+>/.test(value);
const hasMarkdownSyntax = (value: string): boolean => {
  if (!value.trim()) {
    return false;
  }
  const patterns = [
    /^#{1,3}\s/m,
    /^-\s+/m,
    /```/,
    /\*\*[^*]+\*\*/,
    /`[^`]+`/,
    /\[[^\]]+\]\([^)]+\)/,
    /!\[[^\]]*\]\([^)]+\)/
  ];
  return patterns.some((pattern) => pattern.test(value));
};

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

const replaceCustomEmojisInHtml = (html: string, emojiMap: Map<string, string>): string => {
  if (emojiMap.size === 0) {
    return html;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let current = walker.nextNode();
    while (current) {
      textNodes.push(current as Text);
      current = walker.nextNode();
    }
    const regex = /:([a-zA-Z0-9_]+):/g;
    textNodes.forEach((node) => {
      const parent = node.parentElement;
      if (parent && ["CODE", "PRE"].includes(parent.tagName)) {
        return;
      }
      const value = node.nodeValue ?? "";
      if (!regex.test(value)) {
        return;
      }
      regex.lastIndex = 0;
      const fragment = doc.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(value)) !== null) {
        const shortcode = match[1];
        const url = emojiMap.get(shortcode);
        if (match.index > lastIndex) {
          fragment.appendChild(doc.createTextNode(value.slice(lastIndex, match.index)));
        }
        if (url) {
          const img = doc.createElement("img");
          img.setAttribute("src", url);
          img.setAttribute("alt", `:${shortcode}:`);
          img.setAttribute("class", "custom-emoji");
          img.setAttribute("loading", "lazy");
          fragment.appendChild(img);
        } else {
          fragment.appendChild(doc.createTextNode(match[0]));
        }
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) {
        fragment.appendChild(doc.createTextNode(value.slice(lastIndex)));
      }
      node.parentNode?.replaceChild(fragment, node);
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
};

export const ProfileModal = ({
  status,
  account,
  api,
  zIndex,
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
  zIndex?: number;
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
  const [relationship, setRelationship] = useState<AccountRelationship | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [items, setItems] = useState<Status[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const { showToast } = useToast();
  const targetAccountId = status.accountId;
  const profileEmojis = useMemo(() => {
    if (!showCustomEmojis) {
      return [];
    }
    if (profile?.emojis && profile.emojis.length > 0) {
      return profile.emojis;
    }
    return status.accountEmojis;
  }, [profile?.emojis, showCustomEmojis, status.accountEmojis]);
  const emojiMap = useMemo(
    () => (profileEmojis.length > 0 ? buildEmojiMap(profileEmojis) : new Map()),
    [profileEmojis]
  );

  useClickOutside(scrollRef, isTopmost, onClose);
  useClickOutside(profileMenuRef, profileMenuOpen, () => setProfileMenuOpen(false), [profileMenuButtonRef]);

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
    if (!account || !targetAccountId || account.id === targetAccountId) {
      setRelationship(null);
      setFollowError(null);
      setFollowLoading(false);
      setShowUnfollowConfirm(false);
      return;
    }
    let cancelled = false;
    setFollowError(null);
    api
      .fetchAccountRelationship(account, targetAccountId)
      .then((data) => {
        if (cancelled) return;
        setRelationship(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setRelationship(null);
        setFollowError(error instanceof Error ? error.message : "관계 정보를 불러오지 못했습니다.");
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
  const profileOriginUrl = useMemo(
    () => displayProfile.url || status.accountUrl || null,
    [displayProfile.url, status.accountUrl]
  );
  const bioContent = useMemo(() => {
    if (!displayProfile.bio) {
      return null;
    }
    if (hasHtmlTags(displayProfile.bio)) {
      const processed =
        showCustomEmojis && emojiMap.size > 0
          ? replaceCustomEmojisInHtml(displayProfile.bio, emojiMap)
          : displayProfile.bio;
      return { type: "html" as const, value: sanitizeHtml(processed) };
    }
    return {
      type: "text" as const,
      value: renderTextWithEmojis(displayProfile.bio, "profile-bio", true)
    };
  }, [displayProfile.bio, emojiMap, renderTextWithEmojis, showCustomEmojis]);
  const activeHandle = account?.handle ? formatHandle(account.handle, account.instanceUrl) : account?.instanceUrl ?? "";

  const renderFieldValue = useCallback(
    (value: string, index: number) => {
      if (hasHtmlTags(value)) {
        const processed =
          showCustomEmojis && emojiMap.size > 0 ? replaceCustomEmojisInHtml(value, emojiMap) : value;
        return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(processed) }} />;
      }
      if (hasMarkdownSyntax(value)) {
        const markdownEmojiMap = showCustomEmojis ? emojiMap : undefined;
        return (
          <div
            className="profile-field-markdown"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(value, markdownEmojiMap)) }}
          />
        );
      }
      const nodes = renderTextWithEmojis(value, `profile-field-${index}`, false);
      if (isPlainUrl(value)) {
        return <span className="profile-field-link">{nodes}</span>;
      }
      return <span>{nodes}</span>;
    },
    [emojiMap, renderTextWithEmojis, showCustomEmojis]
  );

  const renderFieldLabel = useCallback(
    (label: string, index: number) => {
      if (hasHtmlTags(label)) {
        const processed =
          showCustomEmojis && emojiMap.size > 0 ? replaceCustomEmojisInHtml(label, emojiMap) : label;
        return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(processed) }} />;
      }
      return <span>{renderTextWithEmojis(label, `profile-field-label-${index}`, false)}</span>;
    },
    [emojiMap, renderTextWithEmojis, showCustomEmojis]
  );

  const normalizedAccountHandle = account?.handle ? formatHandle(account.handle, account.instanceUrl) : "";
  const normalizedTargetHandle = rawHandle && account ? formatHandle(rawHandle, account.instanceUrl) : rawHandle;
  const isSelfById = account?.id && targetAccountId ? account.id === targetAccountId : false;
  const isSelfByHandle =
    Boolean(normalizedAccountHandle && normalizedTargetHandle) &&
    normalizedAccountHandle === normalizedTargetHandle;
  const isSelf = Boolean(isSelfById || isSelfByHandle);
  const isFollowing = relationship?.following ?? false;
  const isRequested = relationship?.requested ?? false;
  const isMuted = relationship?.muting ?? false;
  const isBlocked = relationship?.blocking ?? false;
  const followState = isFollowing ? "following" : isRequested ? "requested" : "follow";
  const canFollow = Boolean(account && targetAccountId && !isSelf);
  const canInteractFollow = canFollow && !followLoading;
  const canShowProfileMenu = Boolean(profileOriginUrl) || canFollow;
  const canOpenProfileMenu = Boolean(profileOriginUrl) || canInteractFollow;
  const followLabel =
    followState === "following"
      ? "팔로잉"
      : followState === "requested"
        ? "요청됨"
        : displayProfile.locked
          ? "팔로우 요청"
          : "팔로우";
  const followAriaLabel =
    followState === "requested"
      ? "팔로우 요청됨"
      : followState === "following"
        ? "언팔로우"
        : displayProfile.locked
          ? "팔로우 요청 보내기"
          : "팔로우하기";

  const buildNextRelationship = useCallback(
    (updates: Partial<AccountRelationship>): AccountRelationship => ({
      following: updates.following ?? relationship?.following ?? false,
      requested: updates.requested ?? relationship?.requested ?? false,
      muting: updates.muting ?? relationship?.muting ?? false,
      blocking: updates.blocking ?? relationship?.blocking ?? false
    }),
    [relationship]
  );

  const updateRelationshipOptimistically = useCallback(
    async (
      next: AccountRelationship,
      action: () => Promise<AccountRelationship>,
      fallbackMessage: string,
      successMessage?: string,
      successTone: "success" | "info" = "success"
    ) => {
      if (!account || !targetAccountId) {
        setFollowError("계정을 선택해 주세요.");
        return;
      }
      const previous = relationship;
      setRelationship(next);
      setFollowLoading(true);
      setFollowError(null);
      try {
        const updated = await action();
        setRelationship(updated);
        setShowUnfollowConfirm(false);
        if (successMessage) {
          showToast(successMessage, { tone: successTone });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : fallbackMessage;
        setRelationship(previous);
        setFollowError(message);
        showToast(message, { tone: "error" });
      } finally {
        setFollowLoading(false);
      }
    },
    [account, relationship, showToast, targetAccountId]
  );

  const handleFollowClick = useCallback(() => {
    if (!canInteractFollow) {
      return;
    }
    if (!account || !targetAccountId) {
      setFollowError("계정을 선택해 주세요.");
      return;
    }
    if (followState === "following") {
      setShowUnfollowConfirm(true);
      return;
    }
    if (followState === "requested") {
      updateRelationshipOptimistically(
        buildNextRelationship({ following: false, requested: false }),
        () => api.cancelFollowRequest(account, targetAccountId),
        "팔로우 요청을 취소하지 못했습니다.",
        "팔로우 요청을 취소했습니다."
      );
      return;
    }
    const shouldRequest = displayProfile.locked;
    updateRelationshipOptimistically(
      buildNextRelationship({ following: !shouldRequest, requested: shouldRequest }),
      () => api.followAccount(account, targetAccountId),
      "팔로우에 실패했습니다.",
      shouldRequest ? "팔로우 요청을 보냈습니다." : "팔로우했습니다."
    );
  }, [
    account,
    api,
    buildNextRelationship,
    canInteractFollow,
    displayProfile.locked,
    followState,
    targetAccountId,
    updateRelationshipOptimistically
  ]);

  const handleUnfollowConfirmed = useCallback(() => {
    if (!canInteractFollow) {
      return;
    }
    if (!account || !targetAccountId) {
      setFollowError("계정을 선택해 주세요.");
      return;
    }
    updateRelationshipOptimistically(
      buildNextRelationship({ following: false, requested: false }),
      () => api.unfollowAccount(account, targetAccountId),
      "언팔로우에 실패했습니다.",
      "언팔로우했습니다."
    );
  }, [account, api, buildNextRelationship, canInteractFollow, targetAccountId, updateRelationshipOptimistically]);

  const handleMuteToggle = useCallback(() => {
    if (!canInteractFollow) {
      return;
    }
    if (!account || !targetAccountId) {
      setFollowError("계정을 선택해 주세요.");
      return;
    }
    const next = buildNextRelationship({ muting: !isMuted });
    updateRelationshipOptimistically(
      next,
      () =>
        isMuted
          ? api.unmuteAccount(account, targetAccountId)
          : api.muteAccount(account, targetAccountId),
      isMuted ? "뮤트 해제에 실패했습니다." : "뮤트에 실패했습니다.",
      isMuted ? "뮤트를 해제했습니다." : "뮤트했습니다."
    );
    setProfileMenuOpen(false);
  }, [
    account,
    api,
    buildNextRelationship,
    canInteractFollow,
    isMuted,
    targetAccountId,
    updateRelationshipOptimistically
  ]);

  const handleBlockToggle = useCallback(() => {
    if (!canInteractFollow) {
      return;
    }
    if (!account || !targetAccountId) {
      setFollowError("계정을 선택해 주세요.");
      return;
    }
    const next = buildNextRelationship({
      blocking: !isBlocked,
      following: isBlocked ? undefined : false,
      requested: isBlocked ? undefined : false
    });
    updateRelationshipOptimistically(
      next,
      () =>
        isBlocked
          ? api.unblockAccount(account, targetAccountId)
          : api.blockAccount(account, targetAccountId),
      isBlocked ? "차단 해제에 실패했습니다." : "차단에 실패했습니다.",
      isBlocked ? "차단을 해제했습니다." : "차단했습니다."
    );
    setProfileMenuOpen(false);
  }, [
    account,
    api,
    buildNextRelationship,
    canInteractFollow,
    isBlocked,
    targetAccountId,
    updateRelationshipOptimistically
  ]);

  useEffect(() => {
    if (!isFollowing) {
      setShowUnfollowConfirm(false);
    }
  }, [isFollowing]);

  useEffect(() => {
    if (!profileOriginUrl && !canFollow) {
      setProfileMenuOpen(false);
    }
  }, [canFollow, profileOriginUrl]);

  const handleOpenProfileOrigin = useCallback(() => {
    if (!profileOriginUrl) {
      return;
    }
    window.open(profileOriginUrl, "_blank", "noopener,noreferrer");
    setProfileMenuOpen(false);
  }, [profileOriginUrl]);

  return (
    <div
      className="profile-modal"
      role="dialog"
      aria-modal="true"
      aria-label="사용자 프로필"
      style={zIndex ? { zIndex } : undefined}
    >
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
              <div className="profile-hero-main">
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
              {canShowProfileMenu ? (
                <div className="profile-hero-actions">
                  {canFollow ? (
                    <div className="follow-action">
                    <button
                      type="button"
                      className={`button-with-icon profile-follow-button${
                        followState === "following" ? " is-following" : ""
                      }${followState === "requested" ? " is-requested" : ""}`}
                      onClick={handleFollowClick}
                      disabled={!canInteractFollow}
                      aria-label={followAriaLabel}
                    >
                      {followState === "following" ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <polyline points="5 13 9 17 19 7" />
                        </svg>
                      ) : followState === "requested" ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="12" x2="15" y2="13.5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                      <span>{followLabel}</span>
                    </button>
                    {showUnfollowConfirm ? (
                      <div className="follow-confirm">
                        <div
                          className="follow-confirm-backdrop"
                          onClick={() => setShowUnfollowConfirm(false)}
                        />
                                                        <div
                          className="follow-confirm-tooltip"
                          role="dialog"
                          aria-modal="true"
                          aria-label="언팔로우 확인"
                        >
                          <p>정말 언팔로우할까요?</p>
                          <div className="follow-confirm-actions">
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setShowUnfollowConfirm(false)}
                              disabled={followLoading}
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              className="delete-button"
                              onClick={handleUnfollowConfirmed}
                              disabled={followLoading}
                            >
                              언팔로우
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    </div>
                  ) : null}
                  <div className="profile-action-menu">
                    <button
                      ref={profileMenuButtonRef}
                      type="button"
                      className="icon-button"
                      aria-label="프로필 메뉴 열기"
                      aria-haspopup="menu"
                      aria-expanded={profileMenuOpen}
                      onClick={() => {
                        setShowUnfollowConfirm(false);
                        setProfileMenuOpen((current) => !current);
                      }}
                      disabled={!canOpenProfileMenu}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.7" />
                        <circle cx="12" cy="12" r="1.7" />
                        <circle cx="12" cy="19" r="1.7" />
                      </svg>
                    </button>
                    {profileMenuOpen ? (
                      <>
                        <div className="overlay-backdrop profile-menu-backdrop" aria-hidden="true" />
                        <div ref={profileMenuRef} className="section-menu-panel profile-menu-panel" role="menu">
                          <button type="button" onClick={handleOpenProfileOrigin} disabled={!profileOriginUrl}>
                            원본 사이트에서 보기
                          </button>
                          <button type="button" onClick={handleMuteToggle} disabled={!canInteractFollow}>
                            {isMuted ? "뮤트 해제" : "뮤트하기"}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={handleBlockToggle}
                            disabled={!canInteractFollow}
                          >
                            {isBlocked ? "차단 해제" : "차단하기"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {followError ? <p className="error">{followError}</p> : null}
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
