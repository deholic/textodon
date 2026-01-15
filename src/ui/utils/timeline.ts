import type { AccountPlatform, TimelineType } from "../../domain/types";

export type TimelineOption = {
  id: TimelineType | "divider-before-bookmarks";
  label: string;
  isDivider?: boolean;
};

const TIMELINE_LABELS: Record<TimelineType, string> = {
  home: "홈",
  local: "로컬",
  federated: "연합",
  social: "소셜",
  global: "글로벌",
  notifications: "알림",
  bookmarks: "북마크"
};

const MASTODON_TIMELINES: TimelineType[] = ["home", "local", "federated", "notifications", "bookmarks"];
const MISSKEY_TIMELINES: TimelineType[] = ["home", "local", "social", "global", "notifications"];
const ALL_TIMELINES: TimelineType[] = [
  "home",
  "local",
  "federated",
  "social",
  "global",
  "notifications",
  "bookmarks"
];
const TIMELINE_TYPE_SET = new Set<string>(ALL_TIMELINES);

export const isTimelineType = (value: string): value is TimelineType => {
  return TIMELINE_TYPE_SET.has(value);
};

export const getTimelineOptions = (
  platform?: AccountPlatform | null,
  includeNotifications = true
): TimelineOption[] => {
  const baseList =
    platform === "mastodon"
      ? MASTODON_TIMELINES
      : platform === "misskey"
        ? MISSKEY_TIMELINES
        : ALL_TIMELINES;
  const list = includeNotifications ? baseList : baseList.filter((id) => id !== "notifications");
  
  const options: TimelineOption[] = list.map((id) => ({
    id,
    label: TIMELINE_LABELS[id]
  }));
  
  // 북마크 앞에 구분선 추가
  const bookmarkIndex = options.findIndex(option => option.id === "bookmarks");
  if (bookmarkIndex > 0) {
    options.splice(bookmarkIndex, 0, { id: "divider-before-bookmarks", label: "---", isDivider: true });
  }
  
  return options;
};

export const normalizeTimelineType = (
  value: string | TimelineType | null | undefined,
  platform?: AccountPlatform | null,
  includeNotifications = true
): TimelineType => {
  if (!value || !isTimelineType(value)) {
    return "home";
  }
  const allowed =
    platform === "mastodon" ? MASTODON_TIMELINES : platform === "misskey" ? MISSKEY_TIMELINES : ALL_TIMELINES;
  const filtered = includeNotifications ? allowed : allowed.filter((timeline) => timeline !== "notifications");
  return filtered.includes(value) ? value : "home";
};

export const getTimelineLabel = (timeline: TimelineType): string => TIMELINE_LABELS[timeline];
