import type { Account, Status } from "../domain/types";
import type { CreateStatusInput, MastodonApi } from "../services/MastodonApi";
import { mapStatus } from "./mastodonMapper";

const buildHeaders = (account: Account): HeadersInit => ({
  Authorization: `Bearer ${account.accessToken}`,
  "Content-Type": "application/json"
});

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

  async createStatus(account: Account, input: CreateStatusInput): Promise<Status> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: buildHeaders(account),
      body: JSON.stringify({
        status: input.status,
        visibility: input.visibility,
        in_reply_to_id: input.inReplyToId,
        media_ids: input.mediaIds
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
