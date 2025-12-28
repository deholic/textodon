import type { Account, Status } from "../domain/types";
import type { CreateStatusInput, MastodonApi } from "../services/MastodonApi";
import { mapMisskeyStatus } from "./misskeyMapper";

const normalizeInstanceUrl = (instanceUrl: string): string => instanceUrl.replace(/\/$/, "");

const mapVisibility = (visibility: CreateStatusInput["visibility"]): string => {
  switch (visibility) {
    case "unlisted":
      return "home";
    case "private":
      return "followers";
    case "direct":
      return "specified";
    default:
      return "public";
  }
};

const buildBody = (account: Account, payload: Record<string, unknown>) => ({
  ...payload,
  i: account.accessToken
});

const DEFAULT_REACTION = "👍";

export class MisskeyHttpClient implements MastodonApi {
  async verifyAccount(
    account: Account
  ): Promise<{ accountName: string; handle: string; avatarUrl: string | null }> {
    const response = await fetch(`${normalizeInstanceUrl(account.instanceUrl)}/api/i`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildBody(account, {}))
    });
    if (!response.ok) {
      throw new Error("계정 인증에 실패했습니다.");
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      accountName: String(data.name ?? data.username ?? ""),
      handle: String(data.username ?? ""),
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null
    };
  }

  async fetchHomeTimeline(account: Account, limit: number, maxId?: string): Promise<Status[]> {
    const response = await fetch(`${normalizeInstanceUrl(account.instanceUrl)}/api/notes/timeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        buildBody(account, {
          limit,
          untilId: maxId
        })
      )
    });
    if (!response.ok) {
      throw new Error("타임라인을 불러오지 못했습니다.");
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapMisskeyStatus);
  }

  async uploadMedia(account: Account, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("i", account.accessToken);
    formData.append("file", file);
    const response = await fetch(
      `${normalizeInstanceUrl(account.instanceUrl)}/api/drive/files/create`,
      {
        method: "POST",
        body: formData
      }
    );
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
    const payload: Record<string, unknown> = {
      text: input.status,
      visibility: mapVisibility(input.visibility),
      replyId: input.inReplyToId
    };
    if (input.mediaIds && input.mediaIds.length > 0) {
      payload.fileIds = input.mediaIds;
    }
    const response = await fetch(`${normalizeInstanceUrl(account.instanceUrl)}/api/notes/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        buildBody(account, payload)
      )
    });
    if (!response.ok) {
      throw new Error("글 작성에 실패했습니다.");
    }
    const data = (await response.json()) as { createdNote?: unknown; note?: unknown };
    const created = data.createdNote ?? data.note;
    if (!created) {
      throw new Error("생성된 노트를 찾을 수 없습니다.");
    }
    return mapMisskeyStatus(created);
  }

  async deleteStatus(account: Account, statusId: string): Promise<void> {
    const response = await fetch(`${normalizeInstanceUrl(account.instanceUrl)}/api/notes/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildBody(account, { noteId: statusId }))
    });
    if (!response.ok) {
      throw new Error("게시글 삭제에 실패했습니다.");
    }
  }

  async favourite(account: Account, statusId: string): Promise<Status> {
    try {
      await this.postSimple(account, "/api/notes/reactions/create", {
        noteId: statusId,
        reaction: DEFAULT_REACTION
      });
    } catch {
      await this.postSimple(account, "/api/notes/favorites/create", { noteId: statusId });
    }
    return this.fetchNote(account, statusId);
  }

  async unfavourite(account: Account, statusId: string): Promise<Status> {
    try {
      await this.postSimple(account, "/api/notes/reactions/delete", { noteId: statusId });
    } catch {
      await this.postSimple(account, "/api/notes/favorites/delete", { noteId: statusId });
    }
    return this.fetchNote(account, statusId);
  }

  async reblog(account: Account, statusId: string): Promise<Status> {
    await this.postSimple(account, "/api/notes/create", { renoteId: statusId });
    return this.fetchNote(account, statusId);
  }

  async unreblog(account: Account, statusId: string): Promise<Status> {
    const note = await this.fetchNoteRaw(account, statusId);
    const renoteId = typeof note.myRenoteId === "string" ? note.myRenoteId : "";
    if (!renoteId) {
      throw new Error("취소할 리노트를 찾지 못했습니다.");
    }
    await this.postSimple(account, "/api/notes/delete", { noteId: renoteId });
    return this.fetchNote(account, statusId);
  }

  private async fetchNoteRaw(account: Account, noteId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${normalizeInstanceUrl(account.instanceUrl)}/api/notes/show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildBody(account, { noteId }))
    });
    if (!response.ok) {
      throw new Error("게시글 정보를 불러오지 못했습니다.");
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private async fetchNote(account: Account, noteId: string): Promise<Status> {
    const data = await this.fetchNoteRaw(account, noteId);
    return mapMisskeyStatus(data);
  }

  private async postSimple(account: Account, path: string, payload: Record<string, unknown>) {
    const response = await fetch(`${normalizeInstanceUrl(account.instanceUrl)}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildBody(account, payload))
    });
    if (!response.ok) {
      throw new Error("요청에 실패했습니다.");
    }
  }
}
