export type Visibility = "public" | "unlisted" | "private" | "direct";

export type AccountPlatform = "mastodon" | "misskey";

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
  url: string | null;
  visibility: Visibility;
  spoilerText: string;
  sensitive: boolean;
  card: LinkCard | null;
  repliesCount: number;
  reblogsCount: number;
  favouritesCount: number;
  reblogged: boolean;
  favourited: boolean;
  inReplyToId: string | null;
  mentions: Mention[];
  mediaAttachments: MediaAttachment[];
  reblog: Status | null;
  boostedBy: { name: string; handle: string; url: string | null } | null;
  myReaction: string | null;
};

export type TimelineItem = {
  status: Status;
};
