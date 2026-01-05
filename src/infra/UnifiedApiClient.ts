import type { Account, TimelineType } from "../domain/types";
import type { CustomEmoji } from "../domain/types";
import type { CreateStatusInput, MastodonApi } from "../services/MastodonApi";

export class UnifiedApiClient implements MastodonApi {
  constructor(
    private readonly mastodon: MastodonApi,
    private readonly misskey: MastodonApi
  ) {}

  private getClient(account: Account): MastodonApi {
    return account.platform === "misskey" ? this.misskey : this.mastodon;
  }

  verifyAccount(account: Account): Promise<{ accountName: string; handle: string; avatarUrl: string | null }> {
    return this.getClient(account).verifyAccount(account);
  }

  fetchHomeTimeline(account: Account, limit: number, maxId?: string) {
    return this.getClient(account).fetchHomeTimeline(account, limit, maxId);
  }

  fetchTimeline(account: Account, timeline: TimelineType, limit: number, maxId?: string) {
    return this.getClient(account).fetchTimeline(account, timeline, limit, maxId);
  }

  fetchCustomEmojis(account: Account): Promise<CustomEmoji[]> {
    return this.getClient(account).fetchCustomEmojis(account);
  }

  uploadMedia(account: Account, file: File) {
    return this.getClient(account).uploadMedia(account, file);
  }

  createStatus(account: Account, input: CreateStatusInput) {
    return this.getClient(account).createStatus(account, input);
  }

  deleteStatus(account: Account, statusId: string) {
    return this.getClient(account).deleteStatus(account, statusId);
  }

  favourite(account: Account, statusId: string) {
    return this.getClient(account).favourite(account, statusId);
  }

  unfavourite(account: Account, statusId: string) {
    return this.getClient(account).unfavourite(account, statusId);
  }

  reblog(account: Account, statusId: string) {
    return this.getClient(account).reblog(account, statusId);
  }

  unreblog(account: Account, statusId: string) {
    return this.getClient(account).unreblog(account, statusId);
  }
}
