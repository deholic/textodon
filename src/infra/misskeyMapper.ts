import type { MediaAttachment, Mention, Status, Visibility } from "../domain/types";

const mapVisibility = (visibility: string): Visibility => {
  switch (visibility) {
    case "home":
      return "unlisted";
    case "followers":
      return "private";
    case "specified":
      return "direct";
    default:
      return "public";
  }
};

const mapMediaAttachments = (files: unknown): MediaAttachment[] => {
  if (!Array.isArray(files)) {
    return [];
  }
  return files
    .map((file) => {
      if (!file || typeof file !== "object") {
        return null;
      }
      const typed = file as Record<string, unknown>;
      const id = String(typed.id ?? "");
      const url = typeof typed.url === "string" ? typed.url : "";
      const description = typeof typed.comment === "string" ? typed.comment : null;
      if (!id || !url) {
        return null;
      }
      return { id, url, description };
    })
    .filter((file): file is MediaAttachment => file !== null);
};

const mapMentions = (mentions: unknown): Mention[] => {
  if (!Array.isArray(mentions)) {
    return [];
  }
  return mentions
    .map((mention) => {
      if (!mention || typeof mention !== "object") {
        return null;
      }
      const typed = mention as Record<string, unknown>;
      const id = String(typed.id ?? "");
      const username = String(typed.username ?? "");
      const host = typeof typed.host === "string" ? typed.host : "";
      const handle = host ? `${username}@${host}` : username;
      const displayName = String(typed.name ?? username ?? "");
      const url = typeof typed.url === "string" ? typed.url : null;
      if (!id || !handle) {
        return null;
      }
      return { id, displayName, handle, url };
    })
    .filter((item): item is Mention => item !== null);
};

const mapCustomEmojis = (emojis: unknown): { shortcode: string; url: string }[] => {
  if (Array.isArray(emojis)) {
    return emojis
      .map((emoji) => {
        if (!emoji || typeof emoji !== "object") {
          return null;
        }
        const typed = emoji as Record<string, unknown>;
        const shortcode = typeof typed.name === "string" ? typed.name : "";
        const url = typeof typed.url === "string" ? typed.url : "";
        if (!shortcode || !url) {
          return null;
        }
        return { shortcode, url };
      })
      .filter((item): item is { shortcode: string; url: string } => item !== null);
  }
  if (emojis && typeof emojis === "object") {
    return Object.entries(emojis as Record<string, unknown>)
      .map(([shortcode, url]) => {
        if (typeof url !== "string") {
          return null;
        }
        return { shortcode, url };
      })
      .filter((item): item is { shortcode: string; url: string } => item !== null);
  }
  return [];
};

const mapReplyMention = (reply: unknown): Mention | null => {
  if (!reply || typeof reply !== "object") {
    return null;
  }
  const replyRecord = reply as Record<string, unknown>;
  if (!replyRecord.user || typeof replyRecord.user !== "object") {
    return null;
  }
  const user = replyRecord.user as Record<string, unknown>;
  const id = String(user.id ?? "");
  const username = String(user.username ?? "");
  const host = typeof user.host === "string" ? user.host : "";
  const handle = host ? `${username}@${host}` : username;
  const displayName = String(user.name ?? username ?? "");
  const url = typeof user.url === "string" ? user.url : null;
  if (!id || !handle) {
    return null;
  }
  return { id, displayName, handle, url };
};

const sumReactions = (reactions: unknown): number => {
  if (!reactions || typeof reactions !== "object") {
    return 0;
  }
  return Object.values(reactions).reduce((acc, value) => {
    if (typeof value === "number") {
      return acc + value;
    }
    return acc;
  }, 0);
};

const buildAccountUrl = (
  user: Record<string, unknown>,
  instanceUrl?: string
): string | null => {
  const url = typeof user.url === "string" ? user.url : null;
  if (url) {
    return url;
  }
  const uri = typeof user.uri === "string" ? user.uri : null;
  if (uri) {
    return uri;
  }
  const username = typeof user.username === "string" ? user.username : "";
  if (!username || !instanceUrl) {
    return null;
  }
  const host = typeof user.host === "string" ? user.host : "";
  const base = host ? `https://${host}` : instanceUrl;
  return `${base.replace(/\/$/, "")}/@${username}`;
};

export const mapMisskeyStatusWithInstance = (raw: unknown, instanceUrl?: string): Status => {
  const value = raw as Record<string, unknown>;
  const user = (value.user ?? {}) as Record<string, unknown>;
  const renoteValue = value.renote as Record<string, unknown> | null | undefined;
  const renote = renoteValue ? mapMisskeyStatusWithInstance(renoteValue, instanceUrl) : null;
  const accountName = String(user.name ?? user.username ?? "");
  const accountHandle = String(user.username ?? "");
  const accountUrl = buildAccountUrl(user, instanceUrl);
  const accountAvatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : null;
  const text = String(value.text ?? "");
  const spoilerText = typeof value.cw === "string" ? value.cw : "";
  const files = value.files;
  const mediaAttachments = mapMediaAttachments(files);
  const isSensitive =
    typeof value.isSensitive === "boolean"
      ? value.isSensitive
      : mediaAttachments.length > 0 &&
        Array.isArray(files) &&
        files.some(
          (file) =>
            file &&
            typeof file === "object" &&
            (file as Record<string, unknown>).isSensitive === true
        );
  const reactionsCount =
    typeof value.reactionCount === "number" ? value.reactionCount : sumReactions(value.reactions);
  const reblogged = Boolean(value.myRenoteId);
  const myReaction = typeof value.myReaction === "string" ? value.myReaction : null;
  const favourited = Boolean(value.isFavorited ?? myReaction);
  const customEmojis = mapCustomEmojis(value.emojis);
  const accountEmojis = mapCustomEmojis(user.emojis);
  const baseMentions = mapMentions(value.mentions);
  const replyMention = mapReplyMention(value.reply);
  const mentions =
    replyMention && !baseMentions.some((mention) => mention.id === replyMention.id)
      ? [...baseMentions, replyMention]
      : baseMentions;
  return {
    id: String(value.id ?? ""),
    createdAt: String(value.createdAt ?? ""),
    accountName,
    accountHandle,
    accountUrl,
    accountAvatarUrl,
    content: text,
    url: typeof value.url === "string" ? value.url : typeof value.uri === "string" ? value.uri : null,
    visibility: mapVisibility(String(value.visibility ?? "public")),
    spoilerText,
    sensitive: Boolean(spoilerText) || isSensitive,
    card: null,
    repliesCount: Number(value.repliesCount ?? 0),
    reblogsCount: Number(value.renoteCount ?? 0),
    favouritesCount: Number(reactionsCount ?? 0),
    reblogged,
    favourited,
    inReplyToId: value.replyId ? String(value.replyId) : null,
    mentions,
    mediaAttachments,
    reblog: renote,
    boostedBy: renote ? { name: accountName, handle: accountHandle, url: accountUrl } : null,
    myReaction,
    customEmojis,
    accountEmojis
  };
};

export const mapMisskeyStatus = (raw: unknown): Status => {
  return mapMisskeyStatusWithInstance(raw);
};
