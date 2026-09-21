import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";
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

  // Next também escuta `upgrade` depois do prepare (HMR e app/ws). Se o
  // handler dele vê `/ws`, dá socket.end() e o cliente cai com 1006 — o
  // traço otimista fica na tela e o relógio do servidor continua.
  keepNextOffGameSocket(server, (request, socket, head) => {
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

function keepNextOffGameSocket(
  server: Server,
  dispatch: (request: IncomingMessage, socket: Duplex, head: Buffer) => void,
) {
  const rawOn = server.on.bind(server);
  const rawAdd = server.addListener.bind(server);
  const rawPrepend = server.prependListener.bind(server);

  const wrap =
    (add: typeof rawOn) =>
    (event: string | symbol, listener: (...args: unknown[]) => void) => {
      if (event !== "upgrade") return add(event, listener);
      return add(event, (request: { url?: string }, socket: unknown, head: unknown) => {
        const pathname = parse(request.url ?? "/").pathname ?? "";
        if (pathname === "/ws") return;
        listener(request, socket, head);
      });
    };

  server.on = wrap(rawOn) as Server["on"];
  server.addListener = wrap(rawAdd) as Server["addListener"];
  server.prependListener = wrap(rawPrepend) as Server["prependListener"];
  rawOn("upgrade", dispatch);
}

void main();
