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
  emojis: CustomEmoji[];
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

export type ReactionInput = {
  name: string;
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
  accountId: string | null;
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

export type ProfileField = {
  label: string;
  value: string;
};

export type UserProfile = {
  id: string;
  name: string;
  handle: string;
  url: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  locked: boolean;
  bio: string;
  fields: ProfileField[];
  emojis?: CustomEmoji[];
};

export type AccountRelationship = {
  following: boolean;
  requested: boolean;
};

export type ThreadContext = {
  ancestors: Status[];
  descendants: Status[];
  conversation?: Status[]; // Misskey 전체 대화용 (시간순 정렬)
};

export type TimelineItem = {
  status: Status;
};

export type InstanceInfo = {
  // 공통 필드
  uri: string;
  title: string;
  description?: string;
  
  // Mastodon 전용
  max_toot_chars?: number;
  
  // Misskey 전용
  maxNoteLength?: number;
  
  // 플랫폼 식별
  platform: AccountPlatform;
};

export type CharacterCountStatus = "normal" | "warning" | "limit";
