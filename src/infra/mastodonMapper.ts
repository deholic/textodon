import type { AccountRelationship, MediaAttachment, ProfileField, Reaction, Status, UserProfile } from "../domain/types";

const htmlToText = (html: string): string => {
  // Preserve links as "text (url)" format before DOM parsing
  const withLinkPreservation = html.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)');
  
  const withBreaks = withLinkPreservation
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
    
  const parser = new DOMParser();
  const doc = parser.parseFromString(withBreaks, "text/html");
  const text = doc.body.textContent ?? "";
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const mapMediaAttachments = (attachments: unknown): MediaAttachment[] => {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as Record<string, unknown>;
      const id = String(typed.id ?? "");
      const url = typeof typed.url === "string" ? typed.url : "";
      const description = typeof typed.description === "string" ? typed.description : null;
      if (!id || !url) {
        return null;
      }
      return { id, url, description };
    })
    .filter((item): item is MediaAttachment => item !== null);
};

const mapMentions = (
  mentions: unknown
): { id: string; displayName: string; handle: string; url: string | null }[] => {
  if (!Array.isArray(mentions)) {
    return [];
  }
  return mentions
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as Record<string, unknown>;
      const id = String(typed.id ?? "");
      const handle = String(typed.acct ?? typed.username ?? "");
      const displayName = String(typed.display_name ?? typed.username ?? typed.acct ?? "");
      const url = typeof typed.url === "string" ? typed.url : null;
      if (!id || !handle) {
        return null;
      }
      return { id, displayName, handle, url };
    })
    .filter(
      (item): item is { id: string; displayName: string; handle: string; url: string | null } =>
        item !== null
    );
};

const mapCustomEmojis = (emojis: unknown): { shortcode: string; url: string }[] => {
  if (!Array.isArray(emojis)) {
    return [];
  }
  return emojis
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as Record<string, unknown>;
      const shortcode = typeof typed.shortcode === "string" ? typed.shortcode : "";
      const url = typeof typed.url === "string" ? typed.url : "";
      if (!shortcode || !url) {
        return null;
      }
      return { shortcode, url };
    })
    .filter((item): item is { shortcode: string; url: string } => item !== null);
};

const mapProfileFields = (fields: unknown): ProfileField[] => {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as Record<string, unknown>;
      const label = typeof typed.name === "string" ? typed.name.trim() : "";
      const value = typeof typed.value === "string" ? typed.value.trim() : "";
      if (!label || !value) {
        return null;
      }
      return { label, value };
    })
    .filter((item): item is ProfileField => item !== null);
};

export const mapAccountProfile = (raw: unknown): UserProfile => {
  const value = raw as Record<string, unknown>;
  const id = String(value.id ?? "");
  const name = String(value.display_name ?? value.username ?? "");
  const handle = String(value.acct ?? value.username ?? "");
  const url = typeof value.url === "string" ? value.url : null;
  const avatarUrl = typeof value.avatar === "string" ? value.avatar : null;
  const headerUrl =
    typeof value.header === "string"
      ? value.header
      : typeof value.header_static === "string"
        ? value.header_static
        : null;
  const bio = typeof value.note === "string" ? value.note : "";
  const locked = Boolean(value.locked ?? false);
  return {
    id,
    name,
    handle,
    url,
    avatarUrl,
    headerUrl,
    locked,
    bio,
    fields: mapProfileFields(value.fields)
  };
};

export const mapAccountRelationship = (raw: unknown): AccountRelationship => {
  const value = raw as Record<string, unknown>;
  return {
    following: Boolean(value.following ?? false),
    requested: Boolean(value.requested ?? false)
  };
};

const getHostFromUrl = (url: string | null): string | null => {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
};

const mapReactions = (
  reactions: unknown
): { reactions: Reaction[]; myReaction: string | null } => {
  if (!reactions || typeof reactions !== "object") {
    return { reactions: [], myReaction: null };
  }
  const values = Object.values(reactions as Record<string, unknown>);
  let myReaction: string | null = null;

  const mapped = values
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as Record<string, unknown>;
      const name = typeof typed.name === "string" ? typed.name : "";
      const count = typeof typed.count === "number" ? typed.count : Number(typed.count ?? 0);
      const url =
        (typeof typed.url === "string" ? typed.url : null) ??
        (typeof typed.static_url === "string" ? typed.static_url : null);
      const domain = typeof typed.domain === "string" ? typed.domain : null;
      const isCustom = Boolean(url);
      const host = domain || getHostFromUrl(url);
      const me = typed.me === true;
      if (!name || !Number.isFinite(count) || count <= 0) {
        return null;
      }
      if (me) {
        myReaction = name;
      }
      return {
        name,
        count: Math.floor(count),
        url: isCustom ? url : null,
        isCustom,
        host
      };
    })
    .filter((item): item is Reaction => item !== null)
    .sort((a, b) => {
      if (a.count === b.count) {
        return a.name.localeCompare(b.name);
      }
      return b.count - a.count;
    });

  return { reactions: mapped, myReaction };
};

export const mapStatus = (raw: unknown): Status => {
  const value = raw as Record<string, unknown>;
  const account = (value.account ?? {}) as Record<string, unknown>;
  const reblogValue = value.reblog as Record<string, unknown> | null | undefined;
  const reblog = reblogValue ? mapStatus(reblogValue) : null;
  const accountId = typeof account.id === "string" ? account.id : null;
  const accountName = String(account.display_name ?? account.username ?? "");
  const accountHandle = String(account.acct ?? "");
  const accountUrl = typeof account.url === "string" ? account.url : null;
  const accountAvatarUrl = typeof account.avatar === "string" ? account.avatar : null;
  const spoilerText = String(value.spoiler_text ?? "").trim();
  const sensitive = Boolean(value.sensitive ?? false);
  const cardValue = value.card as Record<string, unknown> | null | undefined;
  const cardUrl = typeof cardValue?.url === "string" ? cardValue.url : null;
  const cardTitle = typeof cardValue?.title === "string" ? cardValue.title : "";
  const cardDescription =
    typeof cardValue?.description === "string" ? cardValue.description : null;
  const cardImage = typeof cardValue?.image === "string" ? cardValue.image : null;
  const hasCardData = Boolean(cardTitle && cardTitle !== cardUrl) || Boolean(cardDescription || cardImage);
  const customEmojis = mapCustomEmojis(value.emojis || []);
  const accountEmojis = mapCustomEmojis(account.emojis || []);
  const { reactions, myReaction } = mapReactions(value.reactions);
  return {
    id: String(value.id ?? ""),
    createdAt: String(value.created_at ?? ""),
    accountId,
    accountName,
    accountHandle,
    accountUrl,
    accountAvatarUrl,
    content: htmlToText(String(value.content ?? "")),
    htmlContent: String(value.content ?? ""),
    hasRichContent: true,
    url:
      typeof value.url === "string"
        ? value.url
        : typeof value.uri === "string"
          ? value.uri
          : null,
    visibility: (value.visibility as "public" | "unlisted" | "private" | "direct") ?? "public",
    spoilerText,
    sensitive,
    card: cardUrl && hasCardData
      ? {
          url: cardUrl,
          title: cardTitle,
          description: cardDescription,
          image: cardImage
        }
      : null,
    repliesCount: Number(value.replies_count ?? 0),
    reblogsCount: Number(value.reblogs_count ?? 0),
    favouritesCount: Number(value.favourites_count ?? 0),
    reactions,
    reblogged: Boolean(value.reblogged ?? false),
    favourited: Boolean(value.favourited ?? false),
    inReplyToId: value.in_reply_to_id ? String(value.in_reply_to_id) : null,
    mentions: mapMentions(value.mentions),
    mediaAttachments: mapMediaAttachments(value.media_attachments),
    reblog,
    boostedBy: reblog ? { name: accountName, handle: accountHandle, url: accountUrl } : null,
    notification: null,
    myReaction,
    customEmojis,
    accountEmojis
  };
};

const STATUS_LIKE_NOTIFICATION_TYPES = new Set<string>(["mention", "status", "update"]);

const getNotificationDescriptor = (type: string): { label: string; fallback: string } => {
  switch (type) {
    case "follow":
      return { label: "팔로우함", fallback: "팔로우했습니다." };
    case "follow_request":
      return { label: "팔로우 요청함", fallback: "팔로우 요청을 보냈습니다." };
    case "favourite":
      return { label: "좋아요함", fallback: "좋아요를 눌렀습니다." };
    case "reblog":
      return { label: "부스트함", fallback: "부스트했습니다." };
    case "poll":
      return { label: "투표함", fallback: "투표했습니다." };
    case "status":
      return { label: "글 작성함", fallback: "새 글을 올렸습니다." };
    case "update":
      return { label: "게시글 수정함", fallback: "게시글을 수정했습니다." };
    case "mention":
      return { label: "멘션함", fallback: "멘션했습니다." };
    default:
      return { label: "알림", fallback: "알림이 도착했습니다." };
  }
};

export const mapNotificationToStatus = (raw: unknown): Status | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const notificationId = String(value.id ?? "");
  const type = typeof value.type === "string" ? value.type : "";
  const createdAt = String(value.created_at ?? "");
  const statusValue = value.status;
  const status = statusValue ? mapStatus(statusValue) : null;
  if (!notificationId) {
    return null;
  }
  const account = (value.account ?? {}) as Record<string, unknown>;
  const accountId = typeof account.id === "string" ? account.id : null;
  const accountName = String(account.display_name ?? account.username ?? "");
  const accountHandle = String(account.acct ?? account.username ?? "");
  const accountUrl = typeof account.url === "string" ? account.url : null;
  const accountAvatarUrl = typeof account.avatar === "string" ? account.avatar : null;
  const descriptor = getNotificationDescriptor(type);
  const target = status;
  const content = target && STATUS_LIKE_NOTIFICATION_TYPES.has(type) ? "" : descriptor.fallback;
  return {
    id: notificationId,
    createdAt: createdAt || status?.createdAt || "",
    accountId,
    accountName,
    accountHandle,
    accountUrl,
    accountAvatarUrl,
    content,
    url: target?.url ?? null,
    visibility: target?.visibility ?? "public",
    spoilerText: "",
    sensitive: Boolean(target?.sensitive ?? false),
    card: target?.card ?? null,
    repliesCount: 0,
    reblogsCount: 0,
    favouritesCount: 0,
    reactions: [],
    reblogged: false,
    favourited: false,
    inReplyToId: target?.inReplyToId ?? null,
    mentions: [],
    mediaAttachments: target?.mediaAttachments ?? [],
    reblog: null,
    boostedBy: null,
    notification: {
      type,
      label: descriptor.label,
      actor: {
        name: accountName,
        handle: accountHandle,
        url: accountUrl,
        avatarUrl: accountAvatarUrl
      },
      target
    },
    myReaction: null,
    customEmojis: target?.customEmojis ?? [],
    accountEmojis: mapCustomEmojis(account.emojis)
  };
};
