import type { Account, CustomEmoji, Status, ThreadContext, TimelineType, InstanceInfo } from "../domain/types";
import type { CreateStatusInput, MastodonApi } from "../services/MastodonApi";
import { mapNotificationToStatus, mapStatus } from "./mastodonMapper";

const buildHeaders = (account: Account): HeadersInit => ({
  Authorization: `Bearer ${account.accessToken}`,
  "Content-Type": "application/json"
});

const mapCustomEmojis = (data: unknown): CustomEmoji[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  const result: CustomEmoji[] = [];
  data.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const typed = item as Record<string, unknown>;
    const shortcode = typeof typed.shortcode === "string" ? typed.shortcode : "";
    const url =
      typeof typed.url === "string"
        ? typed.url
        : typeof typed.static_url === "string"
          ? typed.static_url
          : "";
    if (!shortcode || !url) {
      return;
    }
    result.push({
      shortcode,
      url,
      category: typeof typed.category === "string" ? typed.category : null
    });
  });
  return result;
};

export class MastodonHttpClient implements MastodonApi {
  async verifyAccount(
    account: Account
  ): Promise<{ accountName: string; handle: string; avatarUrl: string | null }> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("계정 인증에 실패했습니다.");
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      accountName: String(data.display_name ?? data.username ?? ""),
      handle: String(data.acct ?? ""),
      avatarUrl: typeof data.avatar === "string" ? data.avatar : null
    };
  }

  async fetchHomeTimeline(account: Account, limit: number, maxId?: string): Promise<Status[]> {
    const url = new URL(`${account.instanceUrl}/api/v1/timelines/home`);
    url.searchParams.set("limit", String(limit));
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("타임라인을 불러오지 못했습니다.");
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapStatus);
  }

  async fetchTimeline(
    account: Account,
    timeline: TimelineType,
    limit: number,
    maxId?: string
  ): Promise<Status[]> {
    if (timeline === "home") {
      return this.fetchHomeTimeline(account, limit, maxId);
    }
    if (timeline === "notifications") {
      return this.fetchNotifications(account, limit, maxId);
    }
    const url = new URL(`${account.instanceUrl}/api/v1/timelines/public`);
    url.searchParams.set("limit", String(limit));
    if (timeline === "local") {
      url.searchParams.set("local", "true");
    }
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("타임라인을 불러오지 못했습니다.");
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapStatus);
  }

  async fetchCustomEmojis(account: Account): Promise<CustomEmoji[]> {
    const response = await fetch(`${account.instanceUrl}/api/v1/custom_emojis`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("이모지를 불러오지 못했습니다.");
    }
    const data = (await response.json()) as unknown;
    return mapCustomEmojis(data);
  }

  async fetchInstanceInfo(account: Account): Promise<InstanceInfo> {
    // 먼저 v2 API를 시도
    try {
      const v2Response = await fetch(`${account.instanceUrl}/api/v2/instance`, {
        headers: buildHeaders(account)
      });
      if (v2Response.ok) {
        const v2Data = (await v2Response.json()) as Record<string, unknown>;
        const configuration = v2Data.configuration as Record<string, unknown> || {};
        const statuses = configuration.statuses as Record<string, unknown> || {};
        
        // v2 API에서 max_characters 가져오기, 없으면 v1 호환 필드 사용
        const maxChars = typeof statuses.max_characters === "number" 
          ? statuses.max_characters 
          : typeof v2Data.max_toot_chars === "number" 
            ? v2Data.max_toot_chars 
            : 500;
        
        return {
          uri: String(v2Data.uri || v2Data.domain || ""),
          title: String(v2Data.title || ""),
          description: v2Data.description ? String(v2Data.description) : undefined,
          max_toot_chars: maxChars,
          platform: "mastodon"
        };
      }
    } catch {
      // v2 API 실패 시 v1 API로 fallback
    }

    const v1Response = await fetch(`${account.instanceUrl}/api/v1/instance`, {
      headers: buildHeaders(account)
    });
    if (!v1Response.ok) {
      throw new Error("인스턴스 정보를 불러오지 못했습니다.");
    }
    const data = (await v1Response.json()) as Record<string, unknown>;
    
    // v1 API에서 configuration 확인 (이전 버전과의 호환성)
    let maxChars = 500;
    if (typeof data.max_toot_chars === "number") {
      maxChars = data.max_toot_chars;
    } else if (data.configuration && typeof data.configuration === "object") {
      const config = data.configuration as Record<string, unknown>;
      if (config.statuses && typeof config.statuses === "object") {
        const statuses = config.statuses as Record<string, unknown>;
        if (typeof statuses.max_characters === "number") {
          maxChars = statuses.max_characters;
        }
      }
    }
    
    return {
      uri: String(data.uri || data.domain || ""),
      title: String(data.title || ""),
      description: data.description ? String(data.description) : undefined,
      max_toot_chars: maxChars,
      platform: "mastodon"
    };
  }

  async uploadMedia(account: Account, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${account.instanceUrl}/api/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`
      },
      body: formData
    });
    if (!response.ok) {
      throw new Error("이미지 업로드에 실패했습니다.");
    }
    const data = (await response.json()) as Record<string, unknown>;
    const id = String(data.id ?? "");
    if (!id) {
      throw new Error("업로드된 미디어 정보를 찾을 수 없습니다.");
    }
    return id;
  }

  async fetchContext(account: Account, statusId: string): Promise<ThreadContext> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}/context`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("스레드 컨텍스트를 불러오지 못했습니다.");
    }
    const data = (await response.json()) as Record<string, unknown>;
    
    // 마스토돈 API 응답: { ancestors: Status[], descendants: Status[] }
    const ancestors = Array.isArray(data.ancestors) 
      ? data.ancestors.map(mapStatus).filter((status): status is Status => status !== null)
      : [];
    
    const descendants = Array.isArray(data.descendants)
      ? data.descendants.map(mapStatus).filter((status): status is Status => status !== null)
      : [];

    return {
      ancestors,
      descendants
    };
  }

  async createStatus(account: Account, input: CreateStatusInput): Promise<Status> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: buildHeaders(account),
      body: JSON.stringify({
        status: input.status,
        visibility: input.visibility,
        in_reply_to_id: input.inReplyToId,
        media_ids: input.mediaIds,
        spoiler_text: input.spoilerText
      })
    });
    if (!response.ok) {
      throw new Error("글 작성에 실패했습니다.");
    }
    const data = (await response.json()) as unknown;
    return mapStatus(data);
  }

  async deleteStatus(account: Account, statusId: string): Promise<void> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}`, {
      method: "DELETE",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("게시글 삭제에 실패했습니다.");
    }
  }

  async favourite(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "favourite");
  }

  async unfavourite(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "unfavourite");
  }

  async reblog(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "reblog");
  }

  async unreblog(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "unreblog");
  }

  private async fetchNotifications(
    account: Account,
    limit: number,
    maxId?: string
  ): Promise<Status[]> {
    const url = new URL(`${account.instanceUrl}/api/v1/notifications`);
    url.searchParams.set("limit", String(limit));
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error("알림을 불러오지 못했습니다.");
    }
    const data = (await response.json()) as unknown[];
    return data
      .map((item) => mapNotificationToStatus(item))
      .filter((item): item is Status => item !== null);
  }

  private async postAction(account: Account, statusId: string, action: string): Promise<Status> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}/${action}`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      if (errorBody) {
        try {
          const data = JSON.parse(errorBody) as { error?: string; message?: string };
          const message = data.error || data.message;
          if (message) {
            throw new Error(message);
          }
        } catch {
          throw new Error(errorBody);
        }
      }
      throw new Error("요청에 실패했습니다.");
    }
    const data = (await response.json()) as unknown;
    return mapStatus(data);
  }
}
