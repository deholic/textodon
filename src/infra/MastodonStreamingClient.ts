import type { Account, Status } from "../domain/types";
import type { StreamingClient, StreamingEvent } from "../services/StreamingClient";
import { mapStatus } from "./mastodonMapper";

const mapEvent = (payload: MessageEvent<string>): StreamingEvent | null => {
  try {
    const data = JSON.parse(payload.data) as { event?: string; payload?: string };
    if (data.event === "update" && data.payload) {
      return { type: "update", status: mapStatus(JSON.parse(data.payload)) };
    }
    if (data.event === "delete" && data.payload) {
      return { type: "delete", id: data.payload };
    }
    if (data.event === "notification") {
      return { type: "notification" };
    }
    return null;
  } catch {
    return null;
  }
};

export class MastodonStreamingClient implements StreamingClient {
  connect(account: Account, onEvent: (event: StreamingEvent) => void): () => void {
    let isClosed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let retryCount = 0;

    const open = (useQueryToken: boolean) => {
      if (isClosed) {
        return;
      }
      const url = new URL(`${account.instanceUrl.replace(/\/$/, "")}/api/v1/streaming`);
      url.searchParams.set("stream", "user");
      if (useQueryToken) {
        url.searchParams.set("access_token", account.accessToken);
      }

      const wsUrl = url.toString().replace("http", "ws");
      socket = useQueryToken ? new WebSocket(wsUrl) : new WebSocket(wsUrl, account.accessToken);
      let opened = false;
      socket.onmessage = (message) => {
        const event = mapEvent(message as MessageEvent<string>);
        if (event) {
          onEvent(event);
        }
      };
      socket.onopen = () => {
        opened = true;
      };
      socket.onclose = () => {
        if (isClosed) {
          return;
        }
        if (!opened && !useQueryToken) {
          open(true);
          return;
        }
        retryCount += 1;
        const delay = Math.min(1000 * 2 ** retryCount, 15000);
        retryTimer = window.setTimeout(() => open(useQueryToken), delay);
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    open(false);

    return () => {
      isClosed = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      socket?.close();
      socket = null;
    };
  }
}
