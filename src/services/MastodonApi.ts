import type { Account, Status, TimelineType, Visibility, InstanceInfo } from "../domain/types";
import type { CustomEmoji } from "../domain/types";

export type CreateStatusInput = {
  status: string;
  visibility: Visibility;
  inReplyToId?: string;
  mediaIds?: string[];
  spoilerText?: string;
};

export interface MastodonApi {
  verifyAccount(account: Account): Promise<{ accountName: string; handle: string; avatarUrl: string | null }>;
  fetchHomeTimeline(account: Account, limit: number, maxId?: string): Promise<Status[]>;
  fetchTimeline(account: Account, timeline: TimelineType, limit: number, maxId?: string): Promise<Status[]>;
  fetchCustomEmojis(account: Account): Promise<CustomEmoji[]>;
  uploadMedia(account: Account, file: File): Promise<string>;
  createStatus(account: Account, input: CreateStatusInput): Promise<Status>;
  deleteStatus(account: Account, statusId: string): Promise<void>;
  favourite(account: Account, statusId: string): Promise<Status>;
  unfavourite(account: Account, statusId: string): Promise<Status>;
  createReaction(account: Account, statusId: string, reaction: string): Promise<Status>;
  deleteReaction(account: Account, statusId: string): Promise<Status>;
  reblog(account: Account, statusId: string): Promise<Status>;
  unreblog(account: Account, statusId: string): Promise<Status>;
  fetchInstanceInfo(account: Account): Promise<InstanceInfo>;
}
