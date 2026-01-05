import type { AccountPlatform, TimelineType } from "../../domain/types";

export type TimelineOption = {
  id: TimelineType;
  label: string;
};

const TIMELINE_LABELS: Record<TimelineType, string> = {
  home: "홈",
  local: "로컬",
  federated: "연합",
  social: "소셜",
  global: "글로벌",
  notifications: "알림"
};

const MASTODON_TIMELINES: TimelineType[] = ["home", "local", "federated", "notifications"];
const MISSKEY_TIMELINES: TimelineType[] = ["home", "local", "social", "global", "notifications"];
const ALL_TIMELINES: TimelineType[] = [
  "home",
  "local",
  "federated",
  "social",
  "global",
  "notifications"
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
  return list.map((id) => ({
    id,
    label: TIMELINE_LABELS[id]
  }));
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
