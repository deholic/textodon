import type { Account, ThreadContext, TimelineType, InstanceInfo } from "../domain/types";
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

  verifyAccount(
    account: Account
  ): Promise<{ accountName: string; handle: string; avatarUrl: string | null; emojis: CustomEmoji[] }> {
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

  fetchInstanceInfo(account: Account): Promise<InstanceInfo> {
    const client = this.getClient(account) as any;
    return client.fetchInstanceInfo(account);
  }

  fetchAccountProfile(account: Account, accountId: string) {
    return this.getClient(account).fetchAccountProfile(account, accountId);
  }

  fetchAccountRelationship(account: Account, accountId: string) {
    return this.getClient(account).fetchAccountRelationship(account, accountId);
  }

  followAccount(account: Account, accountId: string) {
    return this.getClient(account).followAccount(account, accountId);
  }

  unfollowAccount(account: Account, accountId: string) {
    return this.getClient(account).unfollowAccount(account, accountId);
  }

  cancelFollowRequest(account: Account, accountId: string) {
    return this.getClient(account).cancelFollowRequest(account, accountId);
  }

  fetchAccountStatuses(account: Account, accountId: string, limit: number, maxId?: string) {
    return this.getClient(account).fetchAccountStatuses(account, accountId, limit, maxId);
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

  createReaction(account: Account, statusId: string, reaction: string) {
    return this.getClient(account).createReaction(account, statusId, reaction);
  }

  deleteReaction(account: Account, statusId: string) {
    return this.getClient(account).deleteReaction(account, statusId);
  }

  reblog(account: Account, statusId: string) {
    return this.getClient(account).reblog(account, statusId);
  }

  unreblog(account: Account, statusId: string) {
    return this.getClient(account).unreblog(account, statusId);
  }

  async fetchThreadContext(account: Account, statusId: string): Promise<ThreadContext> {
    if (account.platform === "misskey") {
      // MisskeyHttpClient에는 fetchConversation 메서드가 있음
      const misskeyClient = this.getClient(account) as any;
      return misskeyClient.fetchConversation(account, statusId);
    } else {
      // MastodonHttpClient에는 fetchContext 메서드가 있음
      const mastodonClient = this.getClient(account) as any;
      return mastodonClient.fetchContext(account, statusId);
    }
  }
}
