import type { MediaAttachment, Status } from "../domain/types";

const htmlToText = (html: string): string => {
  const withBreaks = html
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

export const mapStatus = (raw: unknown): Status => {
  const value = raw as Record<string, unknown>;
  const account = (value.account ?? {}) as Record<string, unknown>;
  const reblogValue = value.reblog as Record<string, unknown> | null | undefined;
  const reblog = reblogValue ? mapStatus(reblogValue) : null;
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
  return {
    id: String(value.id ?? ""),
    createdAt: String(value.created_at ?? ""),
    accountName,
    accountHandle,
    accountUrl,
    accountAvatarUrl,
    content: htmlToText(String(value.content ?? "")),
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
    reblogged: Boolean(value.reblogged ?? false),
    favourited: Boolean(value.favourited ?? false),
    inReplyToId: value.in_reply_to_id ? String(value.in_reply_to_id) : null,
    mentions: mapMentions(value.mentions),
    mediaAttachments: mapMediaAttachments(value.media_attachments),
    reblog,
    boostedBy: reblog ? { name: accountName, handle: accountHandle, url: accountUrl } : null,
    myReaction: null
  };
};
