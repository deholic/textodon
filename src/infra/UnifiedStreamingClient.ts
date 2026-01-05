import type { Account, TimelineType } from "../domain/types";
import type { StreamingClient } from "../services/StreamingClient";

export class UnifiedStreamingClient implements StreamingClient {
  constructor(
    private readonly mastodon: StreamingClient,
    private readonly misskey: StreamingClient
  ) {}

  connect(
    account: Account,
    timelineType: TimelineType,
    onEvent: Parameters<StreamingClient["connect"]>[2]
  ): () => void {
    if (account.platform === "misskey") {
      return this.misskey.connect(account, timelineType, onEvent);
    }
    return this.mastodon.connect(account, timelineType, onEvent);
  }
}
