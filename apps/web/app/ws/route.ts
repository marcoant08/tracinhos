import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { bindSocket, type SocketLike } from "@/lib/ws-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return experimental_upgradeWebSocket((ws) => {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    const socket: SocketLike = {
      send: (data) => {
        ws.send(data);
      },
      close: () => {
        ws.close();
      },
      on: (event, listener) => {
        const list = listeners.get(event) ?? [];
        list.push(listener);
        listeners.set(event, list);
      },
    };

    bindSocket(socket);

    ws.on("message", (data: WebSocketData) => {
      for (const listener of listeners.get("message") ?? []) listener(data);
    });
    ws.on("close", () => {
      for (const listener of listeners.get("close") ?? []) listener();
    });
  });
}
