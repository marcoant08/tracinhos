import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node:url";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { WebSocketServer } from "ws";
import { handleRest } from "./lib/http-api";
import { bindSocket, startDisconnectSweeper } from "./lib/ws-server";

const dir = dirname(fileURLToPath(import.meta.url));
loadEnvConfig(dir);

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, dir });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  const upgradeHandler = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    const parsed = parse(req.url ?? "/", true);
    const pathname = parsed.pathname ?? "/";
    void (async () => {
      if (await handleRest(req, res, pathname)) return;
      handle(req, res, parsed);
    })();
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    bindSocket({
      send: (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      },
      close: () => ws.close(),
      on: (event, listener) => {
        if (event === "message") {
          ws.on("message", (data) => listener(data.toString()));
        } else {
          ws.on("close", () => listener());
        }
      },
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url ?? "/");
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
      return;
    }
    void upgradeHandler(request, socket, head);
  });

  startDisconnectSweeper();

  server.listen(port, () => {
    console.log(`Tracinhos em http://localhost:${port}`);
  });
}

void main();
