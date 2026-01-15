import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Status, TimelineType } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import type { StreamingClient } from "../../services/StreamingClient";

const mergeStatus = (items: Status[], next: Status): Status[] => {
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    const copy = [...items];
    copy[index] = next;
    return copy;
  }
  return [next, ...items];
};

const replaceStatus = (items: Status[], next: Status): Status[] => {
  let updated = false;
  const copy = items.map((item) => {
    if (item.id === next.id) {
      updated = true;
      return next;
    }
    if (item.reblog && item.reblog.id === next.id) {
      updated = true;
      return { ...item, reblog: next };
    }
    return item;
  });
  return updated ? copy : items;
};

const appendStatuses = (items: Status[], next: Status[]): Status[] => {
  const existing = new Set(items.map((item) => item.id));
  const filtered = next.filter((item) => !existing.has(item.id));
  return [...items, ...filtered];
};

export const useTimeline = (params: {
  account: Account | null;
  api: MastodonApi;
  streaming: StreamingClient;
  timelineType: TimelineType;
  onNotification?: () => void;
  enableStreaming?: boolean;
}) => {
  const { account, api, streaming, timelineType, onNotification, enableStreaming = true } = params;
  const [items, setItems] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const disconnectRef = useRef<null | (() => void)>(null);
  const notificationDisconnectRef = useRef<null | (() => void)>(null);
  const notificationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    notificationRef.current = onNotification ?? null;
  }, [onNotification]);

  const refresh = useCallback(async () => {
    if (!account) {
      return;
    }
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      let timeline: Status[];
      if (timelineType === "bookmarks") {
        timeline = await api.fetchBookmarks(account, 30);
      } else {
        timeline = await api.fetchTimeline(account, timelineType, 30);
      }
      setItems(timeline);
      setHasMore(timeline.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "타임라인을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [account, api, timelineType]);

  const loadMore = useCallback(async () => {
    if (!account || loadingMore || loading) {
      return;
    }
    const lastId = items[items.length - 1]?.id;
    if (!lastId || !hasMore) {
      return;
    }
    setLoadingMore(true);
    try {
      let next: Status[];
      if (timelineType === "bookmarks") {
        next = await api.fetchBookmarks(account, 20, lastId);
      } else {
        next = await api.fetchTimeline(account, timelineType, 20, lastId);
      }
      setItems((current) => appendStatuses(current, next));
      if (next.length === 0) {
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가 글을 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [account, api, hasMore, items, loading, loadingMore, timelineType]);

  useEffect(() => {
    if (!account) {
      setItems([]);
      setHasMore(false);
      return;
    }
    refresh();
  }, [account, refresh]);

  useEffect(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    notificationDisconnectRef.current?.();
    notificationDisconnectRef.current = null;
    if (!account || !enableStreaming || timelineType === "bookmarks") {
      return;
    }

    disconnectRef.current = streaming.connect(account, timelineType, (event) => {
      if (event.type === "update") {
        if (timelineType !== "notifications") {
          setItems((current) => mergeStatus(current, event.status));
        }
      } else if (event.type === "delete") {
        if (timelineType !== "notifications") {
          setItems((current) => current.filter((item) => item.id !== event.id));
        }
      } else if (event.type === "notification") {
        notificationRef.current?.();
      }
    });

    if (onNotification && timelineType !== "home" && timelineType !== "notifications") {
      notificationDisconnectRef.current = streaming.connect(account, "notifications", (event) => {
        if (event.type === "notification") {
          notificationRef.current?.();
        }
      });
    }

    return () => {
      disconnectRef.current?.();
      disconnectRef.current = null;
      notificationDisconnectRef.current?.();
      notificationDisconnectRef.current = null;
    };
  }, [account, enableStreaming, onNotification, streaming, timelineType]);

  const updateItem = useCallback((status: Status) => {
    setItems((current) => replaceStatus(current, status));
  }, []);

  const removeItem = useCallback((statusId: string) => {
    setItems((current) => current.filter((item) => item.id !== statusId));
  }, []);

  const timeline = useMemo(
    () => ({ items, loading, loadingMore, error, hasMore, refresh, loadMore, updateItem, removeItem }),
    [items, loading, loadingMore, error, hasMore, refresh, loadMore, updateItem, removeItem]
  );

  return timeline;
};
