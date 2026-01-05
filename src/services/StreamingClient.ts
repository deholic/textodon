import type { Account, Status, TimelineType } from "../domain/types";

export type StreamingEvent =
  | { type: "update"; status: Status }
  | { type: "delete"; id: string }
  | { type: "notification" };

export interface StreamingClient {
  connect(account: Account, timelineType: TimelineType, onEvent: (event: StreamingEvent) => void): () => void;
}
