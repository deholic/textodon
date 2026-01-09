import { useCallback, useEffect, useMemo, useState } from "react";
import type { Account, CustomEmoji } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { getCachedEmojis, setCachedEmojis } from "../utils/emojiCache";

const RECENT_EMOJI_KEY_PREFIX = "textodon.compose.recentEmojis.";
const RECENT_EMOJI_LIMIT = 24;

const buildRecentEmojiKey = (instanceUrl: string) =>
  `${RECENT_EMOJI_KEY_PREFIX}${encodeURIComponent(instanceUrl)}`;

const loadRecentEmojis = (instanceUrl: string): string[] => {
  try {
    const stored = localStorage.getItem(buildRecentEmojiKey(instanceUrl));
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
};

const persistRecentEmojis = (instanceUrl: string, list: string[]) => {
  try {
    localStorage.setItem(buildRecentEmojiKey(instanceUrl), JSON.stringify(list));
  } catch {
    return;
  }
};

export type EmojiCategory = {
  id: string;
  label: string;
  emojis: CustomEmoji[];
};

/**
 * 이모지 카탈로그, 최근 사용 이모지, 카테고리화를 관리하는 커스텀 훅
 *
 * @param account - 현재 활성 계정
 * @param api - Mastodon API 인스턴스
 * @param autoLoad - 자동으로 이모지를 로드할지 여부 (기본: false)
 * @returns 이모지 관리 상태 및 함수들
 */
export const useEmojiManager = (
  account: Account | null,
  api: MastodonApi,
  autoLoad: boolean = false
) => {
  const instanceUrl = account?.instanceUrl ?? null;

  // 이모지 카탈로그 상태 (인스턴스별로 관리)
  const [emojiCatalogs, setEmojiCatalogs] = useState<Record<string, CustomEmoji[]>>({});
  const [emojiLoadState, setEmojiLoadState] = useState<
    Record<string, "idle" | "loading" | "loaded" | "error">
  >({});
  const [emojiErrors, setEmojiErrors] = useState<Record<string, string | null>>({});

  // 최근 사용 이모지 (인스턴스별로 관리)
  const [recentByInstance, setRecentByInstance] = useState<Record<string, string[]>>({});

  // 확장된 카테고리 (인스턴스별로 관리)
  const [expandedByInstance, setExpandedByInstance] = useState<Record<string, Set<string>>>({});

  // 현재 인스턴스의 이모지 목록
  const activeEmojis = useMemo(
    () => (instanceUrl ? emojiCatalogs[instanceUrl] ?? [] : []),
    [instanceUrl, emojiCatalogs]
  );

  // 현재 인스턴스의 로드 상태
  const emojiStatus = instanceUrl ? emojiLoadState[instanceUrl] ?? "idle" : "idle";
  const emojiError = instanceUrl ? emojiErrors[instanceUrl] ?? null : null;

  // 최근 사용한 이모지 shortcode 목록
  const recentShortcodes = instanceUrl ? recentByInstance[instanceUrl] ?? [] : [];

  // shortcode → emoji 맵핑
  const emojiMap = useMemo(
    () => new Map(activeEmojis.map((emoji) => [emoji.shortcode, emoji])),
    [activeEmojis]
  );

  // 최근 사용한 이모지 객체 목록
  const recentEmojis = useMemo(
    () => recentShortcodes.map((shortcode) => emojiMap.get(shortcode)).filter(Boolean) as CustomEmoji[],
    [emojiMap, recentShortcodes]
  );

  // 카테고리별로 그룹화된 이모지
  const categorizedEmojis = useMemo(() => {
    const grouped = new Map<string, CustomEmoji[]>();
    activeEmojis.forEach((emoji) => {
      const category = emoji.category?.trim() || "기타";
      const list = grouped.get(category) ?? [];
      list.push(emoji);
      grouped.set(category, list);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ko-KR"))
      .map(([label, emojis]) => ({ id: `category:${label}`, label, emojis }));
  }, [activeEmojis]);

  // 최근 사용 카테고리를 포함한 전체 카테고리 목록
  const emojiCategories = useMemo(() => {
    const categories = [...categorizedEmojis];
    if (recentEmojis.length > 0) {
      categories.unshift({ id: "recent", label: "최근 사용", emojis: recentEmojis });
    }
    return categories;
  }, [categorizedEmojis, recentEmojis]);

  // 현재 인스턴스에서 확장된 카테고리 Set
  const expandedCategories = instanceUrl ? expandedByInstance[instanceUrl] ?? new Set() : new Set();

  // 인스턴스 URL이 변경되면 캐시 확인 및 최근 사용 이모지 로드
  useEffect(() => {
    if (!instanceUrl) {
      return;
    }

    // 캐시에서 이모지 로드
    const cached = getCachedEmojis(instanceUrl);
    if (cached) {
      setEmojiCatalogs((current) => ({ ...current, [instanceUrl]: cached }));
      setEmojiLoadState((current) => ({ ...current, [instanceUrl]: "loaded" }));
      setEmojiErrors((current) => ({ ...current, [instanceUrl]: null }));
    } else {
      // 캐시가 없으면 idle 상태로 초기화
      setEmojiLoadState((current) => {
        if (current[instanceUrl]) return current;
        return { ...current, [instanceUrl]: "idle" };
      });
    }

    // 최근 사용 이모지 로드
    setRecentByInstance((current) => {
      if (current[instanceUrl]) return current;
      return { ...current, [instanceUrl]: loadRecentEmojis(instanceUrl) };
    });

    // 확장된 카테고리 초기화
    setExpandedByInstance((current) => {
      if (current[instanceUrl]) return current;
      return { ...current, [instanceUrl]: new Set() };
    });
  }, [instanceUrl]);

  // 이모지 로드 함수
  const loadEmojis = useCallback(async () => {
    if (!instanceUrl || !account) {
      return;
    }

    // 이미 로드되었거나 로딩 중이면 스킵
    const currentState = emojiLoadState[instanceUrl];
    if (currentState === "loaded" || currentState === "loading") {
      return;
    }

    setEmojiLoadState((current) => ({ ...current, [instanceUrl]: "loading" }));
    setEmojiErrors((current) => ({ ...current, [instanceUrl]: null }));

    try {
      const emojis = await api.fetchCustomEmojis(account);
      setCachedEmojis(instanceUrl, emojis);
      setEmojiCatalogs((current) => ({ ...current, [instanceUrl]: emojis }));
      setEmojiLoadState((current) => ({ ...current, [instanceUrl]: "loaded" }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "이모지 로드 실패";
      setEmojiErrors((current) => ({ ...current, [instanceUrl]: errorMessage }));
      setEmojiLoadState((current) => ({ ...current, [instanceUrl]: "error" }));
    }
  }, [account, api, emojiLoadState, instanceUrl]);

  // autoLoad가 true이면 자동으로 이모지 로드
  useEffect(() => {
    if (autoLoad && instanceUrl && account) {
      void loadEmojis();
    }
  }, [autoLoad, instanceUrl, account, loadEmojis]);

  // 이모지를 최근 사용 목록에 추가
  const addToRecent = useCallback(
    (shortcode: string) => {
      if (!instanceUrl) return;

      setRecentByInstance((current) => {
        const existing = current[instanceUrl] ?? [];
        const filtered = existing.filter((code) => code !== shortcode);
        const nextList = [shortcode, ...filtered].slice(0, RECENT_EMOJI_LIMIT);
        persistRecentEmojis(instanceUrl, nextList);
        return { ...current, [instanceUrl]: nextList };
      });
    },
    [instanceUrl]
  );

  // 카테고리 확장/축소 토글
  const toggleCategory = useCallback(
    (categoryId: string) => {
      if (!instanceUrl) return;

      setExpandedByInstance((current) => {
        const existing = current[instanceUrl] ?? new Set();
        const next = new Set(existing);
        if (next.has(categoryId)) {
          next.delete(categoryId);
        } else {
          next.add(categoryId);
        }
        return { ...current, [instanceUrl]: next };
      });
    },
    [instanceUrl]
  );

  return {
    // 상태
    emojis: activeEmojis,
    emojiStatus,
    emojiError,
    recentEmojis,
    categorizedEmojis,
    emojiCategories,
    expandedCategories,
    emojiMap,

    // 함수
    loadEmojis,
    addToRecent,
    toggleCategory
  };
};
