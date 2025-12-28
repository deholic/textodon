import type { Account } from "../domain/types";
import type { StreamingClient, StreamingEvent } from "../services/StreamingClient";
import { mapMisskeyStatusWithInstance } from "./misskeyMapper";

const normalizeInstanceUrl = (instanceUrl: string): string => instanceUrl.replace(/\/$/, "");
const PING_INTERVAL_MS = 30000;

type MisskeyMessage = {
  type?: string;
  body?: unknown;
};

type ChannelPayload = {
  id?: string;
  type?: string;
  body?: unknown;
};

const mapMisskeyEvent = (
  payload: MessageEvent<string>,
  channelId: string,
  instanceUrl: string
): StreamingEvent | null => {
  try {
    const data = JSON.parse(payload.data) as MisskeyMessage;
    if (data.type === "channel" && data.body && typeof data.body === "object") {
      const channelBody = data.body as ChannelPayload;
      if (channelBody.id !== channelId) {
        return null;
      }
      if (channelBody.type === "note" && channelBody.body) {
        return { type: "update", status: mapMisskeyStatusWithInstance(channelBody.body, instanceUrl) };
      }
      if (channelBody.type === "deleted") {
        const id =
          typeof channelBody.body === "string"
            ? channelBody.body
            : channelBody.body && typeof channelBody.body === "object"
              ? String((channelBody.body as Record<string, unknown>).id ?? "")
              : "";
        return id ? { type: "delete", id } : null;
      }
    }
    if (data.type === "note" && data.body) {
      return { type: "update", status: mapMisskeyStatusWithInstance(data.body, instanceUrl) };
    }
    return null;
  } catch {
    return null;
  }
};

export class MisskeyStreamingClient implements StreamingClient {
  connect(account: Account, onEvent: (event: StreamingEvent) => void): () => void {
    let isClosed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let pingTimer: number | null = null;
    let retryCount = 0;
    let channelId = "";

    const clearTimers = () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (pingTimer) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const send = (payload: Record<string, unknown>) => {
      if (socket?.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify(payload));
    };

    const open = () => {
      if (isClosed) {
        return;
      }
      channelId = crypto.randomUUID();
      const url = new URL(`${normalizeInstanceUrl(account.instanceUrl)}/streaming`);
      url.searchParams.set("i", account.accessToken);
      const wsUrl = url.toString().replace("http", "ws");
      socket = new WebSocket(wsUrl);
      let opened = false;

      socket.onopen = () => {
        opened = true;
        retryCount = 0;
        send({
          type: "connect",
          body: { channel: "homeTimeline", id: channelId }
        });
        pingTimer = window.setInterval(() => send({ type: "ping" }), PING_INTERVAL_MS);
      };

      socket.onmessage = (message) => {
        const raw = message as MessageEvent<string>;
        try {
          const data = JSON.parse(raw.data) as MisskeyMessage;
          if (data.type === "ping") {
            send({ type: "pong" });
            return;
          }
        } catch {
          // ignore parsing errors
        }
        const event = mapMisskeyEvent(raw, channelId, account.instanceUrl);
        if (event) {
          onEvent(event);
        }
      };

      socket.onclose = () => {
        clearTimers();
        if (isClosed) {
          return;
        }
        retryCount += 1;
        const delay = Math.min(1000 * 2 ** retryCount, 15000);
        retryTimer = window.setTimeout(() => open(), delay);
      };

      socket.onerror = () => {
        socket?.close();
      };

      if (!opened) {
        // no-op, handled by onclose retry
      }
    };

    open();

    return () => {
      isClosed = true;
      clearTimers();
      if (socket?.readyState === WebSocket.OPEN && channelId) {
        send({ type: "disconnect", body: { id: channelId } });
      }
      socket?.close();
      socket = null;
    };
  }
}
