export type Visibility = "public" | "unlisted" | "private" | "direct";

export type AccountPlatform = "mastodon" | "misskey";

export type TimelineType = "home" | "local" | "federated" | "social" | "global" | "notifications";

export type Account = {
  id: string;
  instanceUrl: string;
  accessToken: string;
  platform: AccountPlatform;
  name: string;
  displayName: string;
  handle: string;
  url: string | null;
  avatarUrl: string | null;
};

export type MediaAttachment = {
  id: string;
  url: string;
  description: string | null;
};

export type Mention = {
  id: string;
  displayName: string;
  handle: string;
  url: string | null;
};

export type CustomEmoji = {
  shortcode: string;
  url: string;
  category?: string | null;
};

export type Reaction = {
  name: string;
  count: number;
  url: string | null;
  isCustom: boolean;
  host: string | null;
};

export type NotificationActor = {
  name: string;
  handle: string;
  url: string | null;
  avatarUrl: string | null;
};

export type NotificationMeta = {
  type: string;
  label: string;
  actor: NotificationActor;
  target: Status | null;
};

export type LinkCard = {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
};

export type Status = {
  id: string;
  createdAt: string;
  accountName: string;
  accountHandle: string;
  accountUrl: string | null;
  accountAvatarUrl: string | null;
  content: string;
  htmlContent?: string;
  hasRichContent: boolean;
  url: string | null;
  visibility: Visibility;
  spoilerText: string;
  sensitive: boolean;
  card: LinkCard | null;
  repliesCount: number;
  reblogsCount: number;
  favouritesCount: number;
  reactions: Reaction[];
  reblogged: boolean;
  favourited: boolean;
  inReplyToId: string | null;
  mentions: Mention[];
  mediaAttachments: MediaAttachment[];
  reblog: Status | null;
  boostedBy: { name: string; handle: string; url: string | null } | null;
  notification: NotificationMeta | null;
  myReaction: string | null;
  customEmojis: CustomEmoji[];
  accountEmojis: CustomEmoji[];
};

export type TimelineItem = {
  status: Status;
};
