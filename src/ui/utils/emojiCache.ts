import type { CustomEmoji } from "../../domain/types";

const emojiCache = new Map<string, CustomEmoji[]>();

export const getCachedEmojis = (instanceUrl: string): CustomEmoji[] | null =>
  emojiCache.get(instanceUrl) ?? null;

export const setCachedEmojis = (instanceUrl: string, emojis: CustomEmoji[]) => {
  emojiCache.set(instanceUrl, emojis);
};
