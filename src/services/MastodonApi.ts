import type { Account, AccountRelationship, Status, TimelineType, Visibility, InstanceInfo, UserProfile, ThreadContext } from "../domain/types";
import type { CustomEmoji } from "../domain/types";

export type CreateStatusInput = {
  status: string;
  visibility: Visibility;
  inReplyToId?: string;
  mediaIds?: string[];
  spoilerText?: string;
};

export interface MastodonApi {
  verifyAccount(
    account: Account
  ): Promise<{ accountName: string; handle: string; avatarUrl: string | null; emojis: CustomEmoji[] }>;
  fetchHomeTimeline(account: Account, limit: number, maxId?: string): Promise<Status[]>;
  fetchTimeline(account: Account, timeline: TimelineType, limit: number, maxId?: string): Promise<Status[]>;
  fetchCustomEmojis(account: Account): Promise<CustomEmoji[]>;
  uploadMedia(account: Account, file: File): Promise<string>;
  createStatus(account: Account, input: CreateStatusInput): Promise<Status>;
  deleteStatus(account: Account, statusId: string): Promise<void>;
  favourite(account: Account, statusId: string): Promise<Status>;
  unfavourite(account: Account, statusId: string): Promise<Status>;
  bookmark(account: Account, statusId: string): Promise<Status>;
  unbookmark(account: Account, statusId: string): Promise<Status>;
  fetchBookmarks(account: Account, limit?: number, maxId?: string): Promise<Status[]>;
  createReaction(account: Account, statusId: string, reaction: string): Promise<Status>;
  deleteReaction(account: Account, statusId: string): Promise<Status>;
  reblog(account: Account, statusId: string): Promise<Status>;
  unreblog(account: Account, statusId: string): Promise<Status>;
  fetchInstanceInfo(account: Account): Promise<InstanceInfo>;
  fetchAccountProfile(account: Account, accountId: string): Promise<UserProfile>;
  fetchAccountRelationship(account: Account, accountId: string): Promise<AccountRelationship>;
  followAccount(account: Account, accountId: string): Promise<AccountRelationship>;
  unfollowAccount(account: Account, accountId: string): Promise<AccountRelationship>;
  cancelFollowRequest(account: Account, accountId: string): Promise<AccountRelationship>;
  muteAccount(account: Account, accountId: string): Promise<AccountRelationship>;
  unmuteAccount(account: Account, accountId: string): Promise<AccountRelationship>;
  blockAccount(account: Account, accountId: string): Promise<AccountRelationship>;
  unblockAccount(account: Account, accountId: string): Promise<AccountRelationship>;
  fetchAccountStatuses(account: Account, accountId: string, limit: number, maxId?: string): Promise<Status[]>;
  fetchThreadContext(account: Account, statusId: string): Promise<ThreadContext>;
}
